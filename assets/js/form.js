// form.js — handles Formspree submission and inline thank‑you message
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("emailForm");
  const status = document.createElement("p");
  status.id = "formStatus";
  status.className = "status";
  form.after(status);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);

    try {
      const response = await fetch(form.action, {
        method: form.method,
        body: data,
        headers: { "Accept": "application/json" }
      });

      if (response.ok) {
        status.textContent = "✅ Thank you! Your message has been sent successfully.";
        status.classList.add("show");
        form.reset();
      } else {
        status.textContent = "❌ Something went wrong. Please try again later.";
        status.classList.add("show");
      }
    } catch (error) {
      status.textContent = "⚠️ Network error. Please check your connection.";
      console.error(error);
    }
  });
});
