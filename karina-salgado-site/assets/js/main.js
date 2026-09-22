document.documentElement.classList.add("js");

document.addEventListener("DOMContentLoaded", function () {
	var toggle = document.querySelector(".nav-toggle");
	var nav = document.querySelector(".main-nav");

	var revealEls = document.querySelectorAll(".reveal");
	if (revealEls.length) {
		if ("IntersectionObserver" in window) {
			var observer = new IntersectionObserver(
				function (entries) {
					entries.forEach(function (entry) {
						if (entry.isIntersecting) {
							entry.target.classList.add("is-visible");
							observer.unobserve(entry.target);
						}
					});
				},
				{ threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
			);
			revealEls.forEach(function (el) {
				observer.observe(el);
			});
		} else {
			revealEls.forEach(function (el) {
				el.classList.add("is-visible");
			});
		}
	}

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
	var confirmBox = document.getElementById("formConfirm");
	var confirmText = document.getElementById("formConfirmText");
	var copyBtn = document.getElementById("formCopyBtn");

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
			var plainMessage =
				"Nome: " + name + "\nE-mail: " + email + "\nMensagem: " + message;
			var subject = encodeURIComponent("Contato pelo site - " + name);
			var body = encodeURIComponent(
				message + "\n\nEmail para retorno: " + email,
			);
			window.location.href =
				"mailto:contato@karinasalgado.com.br?subject=" +
				subject +
				"&body=" +
				body;

			// mailto: falha em silencio sem cliente de e-mail configurado (comum em
			// navegadores embutidos como Instagram/WhatsApp), entao sempre mostramos
			// a confirmacao na tela com um jeito manual de enviar a mensagem.
			if (confirmBox && confirmText) {
				confirmText.textContent = plainMessage;
				confirmBox.hidden = false;
				confirmBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
			}
		});
	}

	if (copyBtn && confirmText) {
		copyBtn.addEventListener("click", function () {
			var text = confirmText.textContent;
			var restoreLabel = "Copiar mensagem";

			function showCopied() {
				copyBtn.textContent = "Copiado!";
				setTimeout(function () {
					copyBtn.textContent = restoreLabel;
				}, 2000);
			}

			if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(text).then(showCopied);
			} else {
				var textarea = document.createElement("textarea");
				textarea.value = text;
				textarea.style.position = "fixed";
				textarea.style.opacity = "0";
				document.body.appendChild(textarea);
				textarea.select();
				document.execCommand("copy");
				document.body.removeChild(textarea);
				showCopied();
			}
		});
	}
});
