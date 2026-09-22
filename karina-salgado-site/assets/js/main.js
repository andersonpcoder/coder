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
	var whatsappNumber = "5591920054813";

	if (form) {
		form.addEventListener("submit", function (event) {
			event.preventDefault();

			var name = form.querySelector("#name").value.trim();
			var email = form.querySelector("#email").value.trim();
			var message = form.querySelector("#message").value.trim();

			if (!name || !message) {
				return;
			}

			var lines = ["Olá! Meu nome é " + name + "."];
			if (email) lines.push("Meu e-mail: " + email);
			lines.push(message);

			var whatsappUrl =
				"https://wa.me/" +
				whatsappNumber +
				"?text=" +
				encodeURIComponent(lines.join("\n"));

			// window.open() com "noopener" sempre retorna null por especificacao,
			// entao nao da pra usar o retorno para saber se o popup foi bloqueado.
			// A mensagem ja inclui um link manual como reforco para os dois casos.
			window.open(whatsappUrl, "_blank", "noopener");

			if (statusEl) {
				statusEl.innerHTML =
					'Abrimos o WhatsApp em uma nova aba com sua mensagem pronta. Se nada abrir, <a href="' +
					whatsappUrl +
					'" target="_blank" rel="noopener">clique aqui para continuar no WhatsApp</a>.';
				statusEl.hidden = false;
			}

			form.reset();
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
});
