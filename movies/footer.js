document.querySelectorAll(".faq-question").forEach(btn => {
    btn.addEventListener("click", () => {
      const answer = btn.nextElementSibling;
      const icon = btn.querySelector(".faq-icon");
      const isOpen = answer.style.maxHeight && answer.style.maxHeight !== "0px";

      document.querySelectorAll(".faq-answer").forEach(a => a.style.maxHeight = "0");
      document.querySelectorAll(".faq-icon").forEach(i => i.textContent = "+");

      if (!isOpen) {
        answer.style.maxHeight = answer.scrollHeight + "px";
        icon.textContent = "−";
      }
    });
  });

  // Optional animation on hover
  const btn = document.getElementById("install-btn");
  btn.onmouseover = () => {
    btn.style.transform = "scale(1.08)";
    btn.style.boxShadow = "0 6px 18px rgba(0,0,0,0.35)";
  };
  btn.onmouseout = () => {
    btn.style.transform = "scale(1)";
    btn.style.boxShadow = "0 4px 15px rgba(0,0,0,0.25)";
  };

