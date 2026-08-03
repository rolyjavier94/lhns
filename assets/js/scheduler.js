const API_BASE = "https://us-central1-lnhs-eac77.cloudfunctions.net";
const SLOT_MINUTES = 15;
const OPEN_MINUTES = 16 * 60;
const CLOSE_MINUTES = 22 * 60;
const DAYS_TO_SHOW = 60;

let customerSet = new Set();
let internalSet = new Set();

const today = startOfDay(new Date());
const maxDate = addDays(today, DAYS_TO_SHOW - 1);
let currentMonth = startOfMonth(today);
let selectedDate = startOfDay(new Date());

const monthLabelEl = document.getElementById("monthLabel");
const prevMonthEl = document.getElementById("prevMonth");
const nextMonthEl = document.getElementById("nextMonth");
const selectedDatetimeEl = document.getElementById("selectedDatetime");
const signatureCountEl = document.getElementById("signatureCount");
const durationHintEl = document.getElementById("durationHint");
const bookingFormEl = document.getElementById("bookingForm");
const loadingOverlayEl = document.getElementById("loadingOverlay");
const bookingSubmitEl = bookingFormEl ? bookingFormEl.querySelector('button[type="submit"]') : null;

prevMonthEl.addEventListener("click", () => {
  const previousMonth = addMonths(currentMonth, -1);
  const monthEnd = endOfMonth(previousMonth);
  if (monthEnd < today) {
    return;
  }

  currentMonth = previousMonth;
  if (!isDateInWindow(selectedDate)) {
    selectedDate = today;
  }
  renderCalendar();
  renderDaySlots();
});

nextMonthEl.addEventListener("click", () => {
  const followingMonth = addMonths(currentMonth, 1);
  const monthStart = startOfMonth(followingMonth);
  if (monthStart > maxDate) {
    return;
  }

  currentMonth = followingMonth;
  if (!isDateInWindow(selectedDate)) {
    selectedDate = maxDate;
  }
  renderCalendar();
  renderDaySlots();
});

if (signatureCountEl) {
  signatureCountEl.addEventListener("input", () => {
    const signatures = getSignatureCount();
    signatureCountEl.value = String(signatures);
    selectedDatetimeEl.value = "";
    updateDurationHint();
    renderCalendar();
    renderDaySlots();
  });
}

updateDurationHint();

async function loadAvailability() {
  const messageEl = document.getElementById("message");

  try {
    const res = await fetch(`${API_BASE}/getAvailability`);

    if (!res.ok) {
      throw new Error(`Availability request failed (${res.status})`);
    }

    const data = await res.json();
    customerSet = new Set(data.customer || []);
    internalSet = new Set(data.internal || []);
    renderCalendar();
    renderDaySlots();
  } catch (err) {
    const container = document.getElementById("calendar");
    if (container) {
      container.replaceChildren();
      const errorText = document.createElement("p");
      errorText.textContent = "Unable to load availability right now. Please try again shortly.";
      container.appendChild(errorText);
    }
    if (messageEl) {
      messageEl.textContent = "Could not load availability. Check your connection and try again.";
      messageEl.style.color = "red";
    }
  }
}

function renderCalendar() {
  const container = document.getElementById("calendar");
  if (!container) {
    return;
  }

  container.replaceChildren();
  monthLabelEl.textContent = currentMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

  prevMonthEl.disabled = endOfMonth(addMonths(currentMonth, -1)) < today;
  nextMonthEl.disabled = startOfMonth(addMonths(currentMonth, 1)) > maxDate;

  const requiredDuration = getRequiredDurationMinutes(getSignatureCount());
  const firstVisibleDay = startOfWeek(startOfMonth(currentMonth));

  for (let i = 0; i < 42; i++) {
    const day = addDays(firstVisibleDay, i);
    const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
    const inWindow = isDateInWindow(day);
    const dayState = getDayState(day, requiredDuration);

    const dayButton = document.createElement("button");
    dayButton.type = "button";
    dayButton.className = "day-cell";
    if (!isCurrentMonth) {
      dayButton.classList.add("out-month");
    }
    if (isSameDay(day, today)) {
      dayButton.classList.add("today");
    }
    if (isSameDay(day, selectedDate) && inWindow) {
      dayButton.classList.add("selected");
    }
    if (!inWindow) {
      dayButton.disabled = true;
    }
    if (dayState.openCount > 0) {
      dayButton.classList.add("has-open");
    } else if (inWindow) {
      dayButton.classList.add("full");
    }

    const dayNumber = document.createElement("span");
    dayNumber.className = "day-number";
    dayNumber.textContent = String(day.getDate());
    dayButton.appendChild(dayNumber);

    const meta = document.createElement("span");
    meta.className = "day-meta";
    const indicator = document.createElement("span");
    indicator.className = "day-indicator";
    if (!inWindow) {
      meta.textContent = "Outside booking range";
      indicator.classList.add("out-range");
    } else if (dayState.openCount > 0) {
      meta.textContent = `${dayState.openCount} open start${dayState.openCount === 1 ? "" : "s"}`;
      indicator.classList.add("open");
    } else {
      meta.textContent = "No starts open";
      indicator.classList.add("full");
    }
    dayButton.appendChild(indicator);
    dayButton.appendChild(meta);

    dayButton.addEventListener("click", () => {
      selectedDate = startOfDay(day);
      selectedDatetimeEl.value = "";
      renderCalendar();
      renderDaySlots();
    });

    container.appendChild(dayButton);
  }
}

function renderDaySlots() {
  const daySlotsEl = document.getElementById("daySlots");
  if (!daySlotsEl) {
    return;
  }

  daySlotsEl.replaceChildren();

  const signatures = getSignatureCount();
  const requiredDuration = getRequiredDurationMinutes(signatures);
  const startMinutes = getPotentialStartMinutes(requiredDuration);

  const heading = document.createElement("h3");
  heading.textContent = selectedDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
  daySlotsEl.appendChild(heading);

  const hint = document.createElement("p");
  hint.className = "day-slots-hint";
  hint.textContent = `Showing start times for ${formatDuration(requiredDuration)} based on ${signatures} signature${signatures === 1 ? "" : "s"}.`;
  daySlotsEl.appendChild(hint);

  if (!isDateInWindow(selectedDate)) {
    const outOfRange = document.createElement("p");
    outOfRange.textContent = "This date is outside the booking range.";
    daySlotsEl.appendChild(outOfRange);
    return;
  }

  const slotGrid = document.createElement("div");
  slotGrid.className = "slot-grid";

  startMinutes.forEach((minuteOfDay) => {
    const iso = buildSlotIsoFromMinute(selectedDate, minuteOfDay);
    const label = formatMinuteOfDay(minuteOfDay);
    const startState = getStartState(selectedDate, minuteOfDay, requiredDuration);

    if (startState === "customer") {
      const slotEl = document.createElement("div");
      slotEl.className = "slot customer";
      slotEl.textContent = `${label} - Customer Appt`;
      slotGrid.appendChild(slotEl);
      return;
    }

    if (startState === "internal") {
      const slotEl = document.createElement("div");
      slotEl.className = "slot internal";
      slotEl.textContent = `${label} - Unavailable`;
      slotGrid.appendChild(slotEl);
      return;
    }

    const slotButton = document.createElement("button");
    slotButton.type = "button";
    slotButton.className = "slot open";
    slotButton.textContent = `${label} - Available`;

    if (selectedDatetimeEl.value === iso) {
      slotButton.classList.add("selected");
    }

    slotButton.addEventListener("click", () => {
      daySlotsEl.querySelectorAll(".slot.open").forEach((slot) => slot.classList.remove("selected"));
      slotButton.classList.add("selected");
      selectedDatetimeEl.value = iso;
    });

    slotGrid.appendChild(slotButton);
  });

  daySlotsEl.appendChild(slotGrid);
}

function getDayState(day, requiredDuration) {
  const startMinutes = getPotentialStartMinutes(requiredDuration);
  let openCount = 0;

  startMinutes.forEach((minuteOfDay) => {
    if (getStartState(day, minuteOfDay, requiredDuration) === "open") {
      openCount += 1;
    }
  });

  return { openCount };
}

function getStartState(day, startMinute, requiredDuration) {
  let hasCustomer = false;
  let hasInternal = false;

  for (let offset = 0; offset < requiredDuration; offset += SLOT_MINUTES) {
    const iso = buildSlotIsoFromMinute(day, startMinute + offset);
    if (customerSet.has(iso)) {
      hasCustomer = true;
    }
    if (internalSet.has(iso)) {
      hasInternal = true;
    }
  }

  if (hasCustomer) {
    return "customer";
  }
  if (hasInternal) {
    return "internal";
  }
  return "open";
}

function getPotentialStartMinutes(requiredDuration) {
  const starts = [];
  for (let minute = OPEN_MINUTES; minute + requiredDuration <= CLOSE_MINUTES; minute += SLOT_MINUTES) {
    starts.push(minute);
  }
  return starts;
}

function buildSlotIsoFromMinute(day, minuteOfDay) {
  const slot = new Date(day);
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  slot.setHours(hours, minutes, 0, 0);
  return slot.toISOString();
}

function getSignatureCount() {
  if (!signatureCountEl) {
    return 1;
  }

  const parsed = Number.parseInt(signatureCountEl.value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function getRequiredDurationMinutes(signatures) {
  if (signatures <= 10) {
    return 10;
  }
  if (signatures <= 20) {
    return 15;
  }
  return 60;
}

function formatDuration(minutes) {
  if (minutes === 60) {
    return "1 hour";
  }
  return `${minutes} minutes`;
}

function formatMinuteOfDay(minuteOfDay) {
  const hours24 = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = ((hours24 + 11) % 12) + 1;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function updateDurationHint() {
  if (!durationHintEl) {
    return;
  }

  const signatures = getSignatureCount();
  const duration = getRequiredDurationMinutes(signatures);

  if (duration === 10) {
    durationHintEl.textContent = "1-10 signatures: 10 minutes minimum.";
  } else if (duration === 15) {
    durationHintEl.textContent = "11-20 signatures: 15 minutes required.";
  } else {
    durationHintEl.textContent = "21+ signatures: up to 1 hour required.";
  }
}

function isDateInWindow(day) {
  const d = startOfDay(day);
  return d >= today && d <= maxDate;
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfWeek(date) {
  const value = startOfDay(date);
  value.setDate(value.getDate() - value.getDay());
  return value;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addDays(date, amount) {
  const value = new Date(date);
  value.setDate(value.getDate() + amount);
  return startOfDay(value);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isWeekendIso(isoDatetime) {
  const day = new Date(isoDatetime).getDay();
  return day === 0 || day === 6;
}

function setBookingLoadingState(isLoading) {
  if (loadingOverlayEl) {
    loadingOverlayEl.style.display = isLoading ? "flex" : "none";
    loadingOverlayEl.setAttribute("aria-hidden", isLoading ? "false" : "true");
  }

  if (bookingSubmitEl) {
    bookingSubmitEl.disabled = isLoading;
    bookingSubmitEl.textContent = isLoading ? "Booking..." : "Book appointment";
  }
}

if (bookingFormEl) {
  bookingFormEl.addEventListener("submit", async (e) => {
  e.preventDefault();

  const datetime = selectedDatetimeEl.value;
  const msg = document.getElementById("message");
  const signatures = getSignatureCount();
  const durationMinutes = getRequiredDurationMinutes(signatures);

  if (!datetime) {
    msg.textContent = "Please select an available time slot first.";
    msg.style.color = "red";
    return;
  }

  const selected = new Date(datetime);
  const selectedDay = startOfDay(selected);
  const selectedMinute = selected.getHours() * 60 + selected.getMinutes();
  if (getStartState(selectedDay, selectedMinute, durationMinutes) !== "open") {
    msg.textContent = "The selected start time is no longer available for the required duration. Please choose another slot.";
    msg.style.color = "red";
    selectedDatetimeEl.value = "";
    renderCalendar();
    renderDaySlots();
    return;
  }

  if (isWeekendIso(datetime)) {
    const proceed = window.confirm(
      "Weekend appointments are billed at 2.5x regular rates and are considered emergency hearings. Do you want to continue?"
    );

    if (!proceed) {
      msg.textContent = "Booking canceled. Please choose a weekday slot to avoid emergency weekend rates.";
      msg.style.color = "#b45309";
      return;
    }
  }

  const payload = {
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    datetime,
    signatureCount: signatures,
    durationMinutes,
    notes: document.getElementById("notes").value.trim()
  };

  setBookingLoadingState(true);

  try {
    const res = await fetch(`${API_BASE}/bookAppointment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (res.ok && result.success) {
      msg.textContent = "Appointment booked successfully.";
      msg.style.color = "green";
      await loadAvailability();
    } else {
      msg.textContent = `Error: ${result.error || "Unknown error"}`;
      msg.style.color = "red";
    }
  } catch (err) {
    msg.textContent = "Network or server error while booking.";
    msg.style.color = "red";
  } finally {
    setBookingLoadingState(false);
  }
  });
}

loadAvailability();
