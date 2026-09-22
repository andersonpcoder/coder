document.addEventListener("DOMContentLoaded", function () {
	var toggle = document.querySelector(".nav-toggle");
	var nav = document.querySelector(".main-nav");

	if (toggle && nav) {
		toggle.addEventListener("click", function () {
			var isOpen = nav.classList.toggle("is-open");
			toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
		});

		nav.querySelectorAll("a").forEach(function (link) {
			link.addEventListener("click", function () {
				nav.classList.remove("is-open");
				toggle.setAttribute("aria-expanded", "false");
			});
		});
	}

	var form = document.querySelector(".contact-form");
	if (form) {
		form.addEventListener("submit", function (event) {
			event.preventDefault();

			var name = form.querySelector("#name").value.trim();
			var email = form.querySelector("#email").value.trim();
			var message = form.querySelector("#message").value.trim();

			if (!name || !email || !message) {
				return;
			}

			// TODO: substituir por integracao real (backend/e-mail) antes de publicar.
			var subject = encodeURIComponent("Contato pelo site - " + name);
			var body = encodeURIComponent(
				message + "\n\nEmail para retorno: " + email,
			);
			window.location.href =
				"mailto:contato@karinasalgado.com.br?subject=" +
				subject +
				"&body=" +
				body;
		});
	}
});
