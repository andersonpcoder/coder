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

	var form = document.getElementById("contactForm");
	var statusEl = document.getElementById("formStatus");
	var confirmBox = document.getElementById("formConfirm");
	var confirmText = document.getElementById("formConfirmText");
	var copyBtn = document.getElementById("formCopyBtn");

	function fallbackToMailto(name, email, message) {
		var plainMessage =
			"Nome: " + name + "\nE-mail: " + email + "\nMensagem: " + message;
		var subject = encodeURIComponent("Contato pelo site - " + name);
		var body = encodeURIComponent(message + "\n\nEmail para retorno: " + email);
		window.location.href =
			"mailto:karinasalgado7@hotmail.com?subject=" + subject + "&body=" + body;

		// mailto: falha em silencio sem cliente de e-mail configurado (comum em
		// navegadores embutidos como Instagram/WhatsApp), entao sempre mostramos
		// a confirmacao na tela com um jeito manual de enviar a mensagem.
		if (confirmBox && confirmText) {
			confirmText.textContent = plainMessage;
			confirmBox.hidden = false;
			confirmBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
		}
	}

	if (form) {
		form.addEventListener("submit", function (event) {
			event.preventDefault();

			var name = form.querySelector("#name").value.trim();
			var email = form.querySelector("#email").value.trim();
			var message = form.querySelector("#message").value.trim();
			var accessKey = form.querySelector('[name="access_key"]').value;

			if (!name || !email || !message) {
				return;
			}

			if (confirmBox) confirmBox.hidden = true;

			var submitBtn = form.querySelector('button[type="submit"]');
			if (submitBtn) submitBtn.disabled = true;

			// Sem uma access key real do Web3Forms (web3forms.com), pula direto para
			// o fallback mailto: em vez de gastar uma chamada de rede fadada a falhar.
			if (!accessKey || accessKey === "PENDENTE_WEB3FORMS_ACCESS_KEY") {
				if (submitBtn) submitBtn.disabled = false;
				fallbackToMailto(name, email, message);
				return;
			}

			fetch("https://api.web3forms.com/submit", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify({
					access_key: accessKey,
					subject: form.querySelector('[name="subject"]').value,
					name: name,
					email: email,
					message: message,
				}),
			})
				.then(function (response) {
					return response.json().then(function (data) {
						return { ok: response.ok && data.success, data: data };
					});
				})
				.then(function (result) {
					if (submitBtn) submitBtn.disabled = false;

					if (result.ok) {
						form.reset();
						if (statusEl) {
							statusEl.textContent =
								"Mensagem enviada! Em breve entraremos em contato.";
							statusEl.hidden = false;
						}
						return;
					}

					fallbackToMailto(name, email, message);
				})
				.catch(function () {
					if (submitBtn) submitBtn.disabled = false;
					fallbackToMailto(name, email, message);
				});
		});
	}

	var filterBtns = document.querySelectorAll(".filter-btn");
	var blogCards = document.querySelectorAll(".blog-card");
	var blogEmpty = document.getElementById("blogEmpty");

	if (filterBtns.length && blogCards.length) {
		filterBtns.forEach(function (btn) {
			btn.addEventListener("click", function () {
				var filter = btn.getAttribute("data-filter");

				filterBtns.forEach(function (b) {
					b.classList.remove("is-active");
					b.setAttribute("aria-pressed", "false");
				});
				btn.classList.add("is-active");
				btn.setAttribute("aria-pressed", "true");

				var visibleCount = 0;
				blogCards.forEach(function (card) {
					var categories = (card.getAttribute("data-category") || "").split(
						" ",
					);
					var matches = filter === "todos" || categories.indexOf(filter) !== -1;
					card.hidden = !matches;
					if (matches) visibleCount++;
				});

				if (blogEmpty) {
					blogEmpty.hidden = visibleCount !== 0;
				}
			});
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
