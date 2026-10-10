/* =========================================================
   WEBSOUND ACADEMY
   CATEGORIES PAGE
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    const searchInput = document.getElementById("categorySearch");
    const categoryCards = document.querySelectorAll(".category-card");
    const noResults = document.getElementById("noResults");


    /* =====================================================
       CATEGORY SEARCH
    ===================================================== */

    if (searchInput) {

        searchInput.addEventListener("input", function () {

            const searchValue =
                this.value.toLowerCase().trim();

            let visibleCategories = 0;


            categoryCards.forEach(function (card) {

                const categoryName =
                    card.dataset.name.toLowerCase();

                const categoryText =
                    card.innerText.toLowerCase();

                const matches =
                    categoryName.includes(searchValue) ||
                    categoryText.includes(searchValue);


                if (matches) {

                    card.style.display = "";

                    visibleCategories++;

                } else {

                    card.style.display = "none";

                }

            });


            if (visibleCategories === 0) {

                noResults.style.display = "block";

            } else {

                noResults.style.display = "none";

            }

        });

    }

});