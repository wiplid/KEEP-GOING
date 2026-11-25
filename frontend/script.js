const categoriesContainer = document.getElementById("categories");
let cartId = localStorage.getItem("cartId");
const productsContainer = document.getElementById("products");
const showMoreButton = document.querySelector(".show-more");
const searchInput = document.getElementById("search-input");

let searchTimer;
let selectedCategory = "";

const newsletterForm = document.getElementById("newsletter-form");
const newsletterEmail = document.getElementById("newsletter-email");
const newsletterMessage = document.getElementById("newsletter-message");


/* это протест, я не выйду из дома, пока в Россию не вернут скелетонов */

function showSkeletons() {
    productsContainer.innerHTML = "";

    for (let i = 0; i < 8; i++) {
        const card = document.createElement("div");
        card.classList.add("product-card", "skeleton");

        const image = document.createElement("div");
        image.classList.add("product-image");

        const name = document.createElement("div");
        name.classList.add("skeleton-name");

        const price = document.createElement("div");
        price.classList.add("skeleton-price");

        card.append(image, name, price);
        productsContainer.append(card);
    }
}

/* корзина */
if (cartId) {
    fetch(`http://localhost:3000/api/cart/${cartId}`)
        .then(response => {
            if (response.status === 404) {
                localStorage.removeItem("cartId");
                location.reload();
                return;
            }

            return response.json();
        })
        .then(data => {
            if (!data) return;

            document.getElementById("cart-count").textContent = data.totalQuantity;
        });
} else {
    fetch("http://localhost:3000/api/cart", {
        method: "POST"
    })
        .then(response => response.json())
        .then(data => {
            cartId = data.id;
            localStorage.setItem("cartId", cartId);
            document.getElementById("cart-count").textContent = data.totalQuantity;
        });
}


showMoreButton.addEventListener("click", () => {
    productsContainer.classList.add("show-all");
    showMoreButton.style.display = "none";
});

/* каталог */
fetch("http://localhost:3000/api/categories")
    .then(response => response.json())
    .then(data => {
        document.getElementById("products-count").textContent = data.total;

        /* кнопка All */
        const allButton = document.createElement("button");
        allButton.textContent = `All (${data.total})`;
        allButton.classList.add("active");
        categoriesContainer.append(allButton);

        /* общая функция для всех категорий */
        function selectCategory(category, button) {
            selectedCategory = category;

            categoriesContainer.querySelectorAll("button").forEach(button => {
                button.classList.remove("active");
            });

            button.classList.add("active");

            const params = new URLSearchParams();

            if (selectedCategory) {
                params.append("category", selectedCategory);
            }

            if (searchInput.value) {
                params.append("search", searchInput.value);
            }

            showSkeletons();

            fetch(`http://localhost:3000/api/products?${params}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error("Ошибка сервера");
                    }

                    return response.json();
                })
                .then(data => {
                    showProducts(data.items);

                    /* это если на сайте больше 4 карточек в адаптиве то он делает кнопку */
                    if (data.items.length <= 4) {
                        showMoreButton.style.display = "none";
                    } else {
                        showMoreButton.style.display = "";
                        showMoreButton.textContent = `SHOW MORE (${data.items.length - 4})`;
                    }

                    document.getElementById("products-count").textContent = data.total;
                })
                .catch(() => {
                    productsContainer.innerHTML = "";

                    const message = document.createElement("p");
                    message.classList.add("empty-message");
                    message.textContent = "Сервер недоступен. Попробуйте позже";

                    productsContainer.append(message);
                });
        }

        /* обработчик кнопки All */
        allButton.addEventListener("click", () => {
            selectCategory("", allButton);
        });

        /* остальные кнопки */
        data.items.forEach(category => {
            const categoryElement = document.createElement("button");
            categoryElement.textContent = `${category.name} (${category.productsCount})`;

            categoryElement.addEventListener("click", () => {
                selectCategory(category.slug, categoryElement);
            });

            categoriesContainer.append(categoryElement);
        });
    });



/* поиск */
searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
        const params = new URLSearchParams();

        if (selectedCategory) {
            params.append("category", selectedCategory);
        }

        if (searchInput.value) {
            params.append("search", searchInput.value);
        }

        showSkeletons();

        fetch(`http://localhost:3000/api/products?${params}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Ошибка сервера");
                }

                return response.json();
            })
            .then(data => {
                showProducts(data.items);

                /* тоже самое про 4 карточки */
                if (data.items.length <= 4) {
                    showMoreButton.style.display = "none";
                } else {
                    showMoreButton.style.display = "";
                    showMoreButton.textContent = `SHOW MORE (${data.items.length - 4})`;
                }

                document.getElementById("products-count").textContent = data.total;
            })
            .catch(() => {
                productsContainer.innerHTML = "";

                const message = document.createElement("p");
                message.classList.add("empty-message");
                message.textContent = "Сервер недоступен. Попробуйте позже";

                productsContainer.append(message);
            });
    }, 300);
});

showSkeletons();

/* карточки */
fetch("http://localhost:3000/api/products")
    .then(response => {
        if (!response.ok) {
            throw new Error("Ошибка сервера");
        }

        return response.json();
    })
    .then(data => {
        showProducts(data.items);

        /* все те же 4 карточки */
        if (data.items.length <= 4) {
            showMoreButton.style.display = "none";
        } else {
            showMoreButton.style.display = "";
            showMoreButton.textContent = `SHOW MORE (${data.items.length - 4})`;
        }

        document.getElementById("products-count").textContent = data.total;
    })
    .catch(() => {
        productsContainer.innerHTML = "";

        const message = document.createElement("p");
        message.classList.add("empty-message");
        message.textContent = "Сервер недоступен. Попробуйте позже";

        productsContainer.append(message);
    });


/* как отображается карточка */
function showProducts(products) {
    productsContainer.innerHTML = "";

    if (products.length === 0) {
        productsContainer.innerHTML = "";

        const message = document.createElement("p");
        message.classList.add("empty-message");
        message.textContent = "Ничего не найдено";

        productsContainer.append(message);
        return;
    }

    products.forEach(product => {
        const productCard = document.createElement("div");
        productCard.classList.add("product-card");

        const imageContainer = document.createElement("div");
        imageContainer.classList.add("product-image");

        const productImage = document.createElement("img");
        productImage.src = product.image;
        productImage.alt = product.name;

        imageContainer.append(productImage);

        if (!product.inStock) {
            const stockLabel = document.createElement("span");
            stockLabel.classList.add("stock-label");
            stockLabel.textContent = "НЕТ В НАЛИЧИИ";

            imageContainer.append(stockLabel);
            imageContainer.classList.add("out-of-stock");
        }

        if (product.isNew) {
            const newLabel = document.createElement("span");
            newLabel.classList.add("new-label");
            newLabel.textContent = "NEW";
            imageContainer.append(newLabel);
        }

        productCard.append(imageContainer);

        const productInfo = document.createElement("div");
        productInfo.classList.add("product-info");

        const productDetails = document.createElement("div");
        productDetails.classList.add("product-details");

        const productName = document.createElement("h3");
        productName.classList.add("product-name");
        productName.textContent = product.name;
        productDetails.append(productName);

        const priceContainer = document.createElement("div");
        priceContainer.classList.add("product-prices");

        const productPrice = document.createElement("p");
        productPrice.textContent = `${product.price} ₽`;
        priceContainer.append(productPrice);

        if (product.oldPrice) {
            const oldPrice = document.createElement("p");
            oldPrice.classList.add("old-price");
            oldPrice.textContent = `${product.oldPrice} ₽`;
            priceContainer.append(oldPrice);
        }

        productInfo.append(priceContainer);

        productDetails.append(priceContainer);
        productInfo.append(productDetails);

        const productButton = document.createElement("img");
        productButton.classList.add("product-button");
        if (!product.inStock) {
            productButton.classList.add("disabled");
        }
        productButton.src = "img/arrow.png";
        productButton.alt = "Open product";

        productInfo.append(productButton);

        productCard.append(productInfo);
        productsContainer.append(productCard);
    });
}

/* емаил уведомление  */

newsletterForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const email = newsletterEmail.value;
    newsletterMessage.textContent = "";

    const submitButton = newsletterForm.querySelector("button");

    submitButton.disabled = true;
    newsletterMessage.textContent = "Отправка...";

    fetch("http://localhost:3000/api/newsletter", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email: email
        })
    })
        .then(response => {
            if (response.status === 201) {
                newsletterMessage.textContent = "Спасибо за подписку!";              
            } else if (response.status === 409) {
                newsletterMessage.textContent = "Этот email уже подписан.";
            } else if (response.status === 422) {
                newsletterMessage.textContent = "Проверьте правильность email.";
            } else {
                newsletterMessage.textContent = "Произошла ошибка. Попробуйте позже.";
            }
        })
        .catch(() => {
            newsletterMessage.textContent = "Сервер недоступен. Попробуйте позже.";
        })
        .finally(() => {
            submitButton.disabled = false;
            newsletterForm.reset();
            newsletterEmail.addEventListener("input", () => {
                newsletterMessage.textContent = "";
            });
        });
});
