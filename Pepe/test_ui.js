function renderTest(text) {
    var div       = document.createElement('div');
    div.className = 'test';
    div.innerHTML = '<code>' + text + '</code>';

    var resultDiv       = document.createElement('div');
    var result          = getPizzaBase(text);
    resultDiv.innerHTML = [
        'Pizza: ' + result.pizzaName,
        'Confidence: ' + result.confidence
    ].join('<br>');
    div.appendChild(resultDiv);

    document.body.appendChild(div);
}

document.addEventListener('DOMContentLoaded', function () {
    PIZZA_BASE_REQUESTS.forEach(renderTest);
});

