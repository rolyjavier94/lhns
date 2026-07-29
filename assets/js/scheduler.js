const API_BASE = "https://us-central1-lnhs-eac77.cloudfunctions.net";

// Load availability from backend
async function loadAvailability() {
  const messageEl = document.getElementById("message");

  try {
    const res = await fetch(`${API_BASE}/getAvailability`);

    if (!res.ok) {
      throw new Error(`Availability request failed (${res.status})`);
    }

    const data = await res.json();
    renderAvailability(data.customer || [], data.internal || []);
  } catch (err) {
    const container = document.getElementById("calendar");
    if (container) {
      container.innerHTML = "<p>Unable to load availability right now. Please try again shortly.</p>";
    }
    if (messageEl) {
      messageEl.textContent = "Could not load availability. Check your connection and try again.";
      messageEl.style.color = "red";
    }
  }
}

// Render the calendar grid
function renderAvailability(customer, internal) {
  const container = document.getElementById("calendar");
  if (!container) {
    return;
  }

  container.innerHTML = ""; // clear old content

  const now = new Date();
  const daysToShow = 30;

  for (let i = 0; i < daysToShow; i++) {
    const day = new Date(now);
    day.setDate(now.getDate() + i);

    const dateStr = day.toISOString().split("T")[0];

    // Create day block
    const dayBlock = document.createElement("div");
    dayBlock.className = "day";
    dayBlock.innerHTML = `<strong>${dateStr}</strong>`;

    // Business hours: 4 PM – 9 PM
    for (let hour = 16; hour <= 21; hour++) {
      const slot = new Date(day);
      slot.setHours(hour, 0, 0, 0);

      const iso = slot.toISOString();
      const label = `${String(hour).padStart(2, "0")}:00`;

      const slotEl = document.createElement("div");
      slotEl.className = "slot";

      if (customer.includes(iso)) {
        slotEl.textContent = `${label} • Customer Appt`;
        slotEl.classList.add("customer");
      } else if (internal.includes(iso)) {
        slotEl.textContent = `${label} • Unavailable`;
        slotEl.classList.add("internal");
      } else {
        slotEl.textContent = `${label} • Available`;
        slotEl.classList.add("open");

        slotEl.addEventListener("click", () => {
          document.querySelectorAll(".slot.open").forEach(s => s.classList.remove("selected"));
          slotEl.classList.add("selected");
          document.getElementById("selectedDatetime").value = iso;
        });
      }

      dayBlock.appendChild(slotEl);
    }

    container.appendChild(dayBlock);
  }
}

// Booking form submit
document.getElementById("bookingForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const datetime = document.getElementById("selectedDatetime").value;
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
