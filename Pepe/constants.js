// todo:  Need a better way to filter and match n-grams within arbitrary lists
// Replace n-grams with hyphenated versions so they effectively turn into 1-grams
// simplifies edit distance calculation

// Correspondingly, need to expand contractions and do substitutions on raw text to normalize it

/**
 * @constant
 * @type {string[]}
 */
var PIZZA_BASE = [
    'margherita',
    'polo',
    'pepperoni',
    'siciliana',
    'florentina',
    'pescatora',
    'quattro formaggi',
    'vegitariano',

    'tomato & cipolta',
    'bianca',
    'greco',
    'polpettine',
    'tropicana',
    'quattro stagioni',
    'mexicana',
    'goat cheese'
];

/**
 * Test for if a token is a valid pizza name.
 * @type {RegExp}
 */
var VALID_PIZZA_NAME_PREFIX = new RegExp(
    '^(' + PIZZA_BASE.map(function (name) {
        return name.substr(0, 3);
    }).join('|') + ')'
);

/**
 * @param token
 * @returns {boolean}
 */
function isValidPizzaNamePrefix(token) {
    return VALID_PIZZA_NAME_PREFIX.test(token);
}

/**
 * @constant
 * @type {string[]}
 */
var TOPPINGS = [
    'cheese',
    'mushrooms',
    'pepperoni',
    'mozzarella',
    'anchovies',
    'olives',
    'capers',
    'spinach',
    'egg',
    'seafood',
    'parmigiano',
    'aubergines',
    'courgette',
    'peppers',
    'sweetcorn',
    'tuna',
    'onions',
    'asparagus',
    'tomatoes',
    'feta',
    'meatballs',
    'pineapple',
    'ham',
    'artichoke',
    'jalapenos'
];

/**
 * Test for if a token is a valid topping name.
 * @type {RegExp}
 */
var VALID_TOPPING_NAME_PREFIX = new RegExp(
    '^(' + TOPPINGS.map(function (name) {
        return name.substr(0, 3);
    }).join('|') + ')'
);

/**
 * @param token
 * @returns {boolean}
 */
function isValidToppingNamePrefix(token) {
    return VALID_TOPPING_NAME_PREFIX.test(token);
}

var COST_PIZZA_BASE = [
    3,
    5.5,
    5,
    5.5,
    5,
    6.5,
    6.5,
    6.5,
    5.5,
    6.5,
    5.5,
    6.5,
    5.5,
    6.5,
    5,
    5.5
];

/**
 * Get total cost of the pizza.
 * @param pizzaBase
 * @param pizzaToppings
 * @returns {number}
 */
function getTotalCost(pizzaBase, pizzaToppings) {
    var costIndex = PIZZA_BASE.indexOf(pizzaBase);
    var cost = COST_PIZZA_BASE[costIndex];

    if(pizzaToppings && pizzaToppings.length > 0) {
        cost += pizzaToppings.length;
    }

    return cost;
}