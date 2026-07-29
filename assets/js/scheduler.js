const API_BASE = "https://us-central1-lnhs-eac77.cloudfunctions.net";
const HOURS = [16, 17, 18, 19, 20, 21];
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

// Load availability from backend
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

  const firstVisibleDay = startOfWeek(startOfMonth(currentMonth));

  for (let i = 0; i < 42; i++) {
    const day = addDays(firstVisibleDay, i);
    const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
    const inWindow = isDateInWindow(day);
    const dayState = getDayState(day);

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
      meta.textContent = `${dayState.openCount} open slot${dayState.openCount === 1 ? "" : "s"}`;
      indicator.classList.add("open");
    } else {
      meta.textContent = "No slots open";
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

  const heading = document.createElement("h3");
  heading.textContent = selectedDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
  daySlotsEl.appendChild(heading);

  if (!isDateInWindow(selectedDate)) {
    const outOfRange = document.createElement("p");
    outOfRange.textContent = "This date is outside the booking range.";
    daySlotsEl.appendChild(outOfRange);
    return;
  }

  const slotGrid = document.createElement("div");
  slotGrid.className = "slot-grid";

  HOURS.forEach((hour) => {
    const iso = buildSlotIso(selectedDate, hour);
    const label = `${String(hour).padStart(2, "0")}:00`;

    if (customerSet.has(iso)) {
      const slotEl = document.createElement("div");
      slotEl.className = "slot customer";
      slotEl.textContent = `${label} - Customer Appt`;
      slotGrid.appendChild(slotEl);
      return;
    }

    if (internalSet.has(iso)) {
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

function getDayState(day) {
  let openCount = 0;

  HOURS.forEach((hour) => {
    const iso = buildSlotIso(day, hour);
    if (!customerSet.has(iso) && !internalSet.has(iso)) {
      openCount += 1;
    }
  });

  return { openCount };
}

function buildSlotIso(day, hour) {
  const slot = new Date(day);
  slot.setHours(hour, 0, 0, 0);
  return slot.toISOString();
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

// Booking form submit
document.getElementById("bookingForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const datetime = selectedDatetimeEl.value;
  const msg = document.getElementById("message");

  if (!datetime) {
    msg.textContent = "Please select an available time slot first.";
    msg.style.color = "red";
    return;
  }

  const payload = {
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    datetime,
    notes: document.getElementById("notes").value.trim()
  };

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
      await loadAvailability(); // refresh calendar
    } else {
      msg.textContent = `Error: ${result.error || "Unknown error"}`;
      msg.style.color = "red";
    }
  } catch (err) {
    msg.textContent = "Network or server error while booking.";
    msg.style.color = "red";
  }
});

// Initial load
loadAvailability();
