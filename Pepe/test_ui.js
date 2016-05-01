function renderTest(text) {
    var div       = document.createElement('div');
    div.className = 'test';
    div.innerHTML = '<code>' + text + '</code>';

    var resultDiv      = document.createElement('div');
    var result         = getPizzaBase(text);
    var resultToppings = getPizzaToppings(text);

    resultDiv.innerHTML = [
        'Pizza: ' + result.pizzaName,
        'Confidence: ' + result.confidence,
        resultToppings.length > 0 ? 'Extra toppings: ' + resultToppings.join(', ') : false,
        'Price: ' + getTotalCost(result.pizzaName, resultToppings).toFixed(2)
    ].filter(Boolean).join('<br>');
    div.appendChild(resultDiv);

    this.appendChild(div);
}

document.addEventListener('DOMContentLoaded', function () {
    PIZZA_BASE_REQUESTS
        .forEach(renderTest.bind(document.body));
});

