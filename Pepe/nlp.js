/**
 * Sort comparison function
 * @param a
 * @param b
 * @returns {number}
 */
function SORT_SCORE_DECREASING(a, b) { return b.score - a.score; }

function calculatePizzaBaseConfidence(tokenCount, token, tokenIndex) {
    var favorWordOrder = (tokenIndex / Math.pow(tokenCount, 2) );

    return PIZZA_BASE
        .map(getEditDistance.bind(null, token))
        .map(function (dist, i) {
            var pizzaNameLength = PIZZA_BASE[i].length;

            var score = 1 - (dist / pizzaNameLength) - favorWordOrder;

            // Metric explanation:
            // - (dist / pizzaNameLength)       = Penalize pizza names that are further from token and longer
            // - (tokenIndex / tokenCount)      = Favor words that come first

            return {
                pizzaName : PIZZA_BASE[i],
                score     : score

            };
        })
        .sort(SORT_SCORE_DECREASING);
}

function calculateToppingConfidence(token) {
    return TOPPINGS
        .map(getEditDistance.bind(null, token))
        .map(function (dist, i) {
            var toppingName = TOPPINGS[i];

            // Penalize topping names that are further from token and longer
            var score = 1 - (dist / toppingName.length);

            return {
                toppingName : toppingName,
                score       : score
            };
        })
        .sort(SORT_SCORE_DECREASING);
}

/**
 * Extract the best match for a pizza-base name out of an array of tokens.
 * @param {string[]} tokens
 * @returns {{token: {string}, pizzaName: {string}, confidence: number}}
 */
function getMostConfidentPizzaBase(tokens) {
    var tokenScoring = tokens
        .map(calculatePizzaBaseConfidence.bind(null, tokens.length))
        .map(function (scores) {
            return scores[0];
        });

    var confidenceScores = tokenScoring.map(function (scoring) {
        return scoring.score;
    });

    var mostConfident      = Math.max.apply(Math, confidenceScores);
    var mostConfidentIndex = confidenceScores.indexOf(mostConfident);

    return {
        token      : tokens[mostConfidentIndex],
        pizzaName  : tokenScoring[mostConfidentIndex].pizzaName,
        confidence : mostConfident
    };
}

/**
 * Extract the best matches for toppings out of an array of tokens.
 * @param {string[]} tokens
 * @param {number} confidenceThreshold
 * @returns {object[]}
 */
function getMostConfidentToppings(tokens, confidenceThreshold) {
    var confidenceScores = tokens
        .map(calculateToppingConfidence);

    return confidenceScores
        .map(function (confidence) {
            if (confidence[0].score >= confidenceThreshold) {
                return {
                    toppingName : confidence[0].toppingName,
                    score       : confidence[0].score
                };
            }
        })
        .filter(Boolean);
}

// Filter to replace "connecting words"
var USELESS_WORD = new RegExp([
    'please',
    'pls',
    'and',
    'the',
    'extra'
].join('|'));

function isNotUselessWord(token) {
    return !USELESS_WORD.test(token);
}

// todo: func to replace n-grams from whitelist with hyphenated versions
var CONTRACTIONS = {
    'marg'   : 'margherita',
    'peppe'  : 'pepperoni',
    'pepp'   : 'pepperoni',
    'jalep'  : 'jalapenos',
    'jalap'  : 'jalapenos',
    'frutti' : 'pescatora'
};

function expandContractions(token) {
    if (token in CONTRACTIONS) {
        return CONTRACTIONS[token];
    } else {
        return token;
    }
}

/**
 *
 * @param {string} pizzaRequestText
 * @returns {{token: string, pizzaName: string, confidence: number}}
 */
function getPizzaBase(pizzaRequestText) {
    var normalizedText = pizzaRequestText
        .toLowerCase()
        .split(/with/)[0];  // discard toppings (any words after "with")

    // todo: detect a double pizza order...

    // "What is an n-gram?" : https://en.wikipedia.org/wiki/N-gram
    // old: not accounting for hypens "/\w+/g"
    var tokens_1gram = normalizedText
        .replace(/ /g, ' ')              // replace multiple spaces with single space
        .match(/[a-z-]+/g)              // split into single tokens, accounting for hyphens
        .filter(isNotUselessWord)
        .map(expandContractions);

    // Generate 2-grams for pizza names with 2 words
    var tokens_2gram = tokens_1gram
        .map(function (token, i) {
            if (i !== tokens_1gram.length - 1) {
                return tokens_1gram[i] + ' ' + tokens_1gram[i + 1];
            }
        })
        .filter(Boolean);

    // Remove all unigrams that don't start with the same letters as a valid pizza name.
    var valid_tokens_1gram = tokens_1gram.filter(isValidPizzaNamePrefix);

    var result_1gram = getMostConfidentPizzaBase(valid_tokens_1gram);

    if (result_1gram.confidence < 0.8) { // confidence threshold
        if (tokens_2gram.length > 0) {
            var result_2gram = getMostConfidentPizzaBase(tokens_2gram);

            if (result_2gram.confidence > result_1gram.confidence) {
                return result_2gram;
            } else {
                //result_1gram.inconclusive = true;
                return result_1gram;
            }
        } else {
            //result_1gram.inconclusive = true;
            return result_1gram;
        }
    } else {
        return result_1gram;
    }

}

var CONTAINS_WITH  = /\bwith\b/;
var CONTAINS_EXTRA = /\b[e]xtra\b/;

function getPizzaToppings(pizzaRequestText) {
    var threshold = 0.6; // default is low, let most matches through when we know there are definitely extra toppings
    var normalizedText = pizzaRequestText
        .toLowerCase();

    // Catch case where pizza name and topping name is the same
    // ex: avoid adding extra pepperoni when ordering just a pepperoni

    if (CONTAINS_WITH.test(normalizedText)) {
        normalizedText = normalizedText.split(CONTAINS_WITH)[1];
        threshold -= 0.05;
    }

    if (CONTAINS_EXTRA.test(normalizedText)) {
        threshold -= 0.15;
    }

    var tokens_1gram = normalizedText
        .match(/\w+/g)                      // split into single tokens, accounting for hyphens
        .filter(isNotUselessWord)
        .filter(isValidToppingNamePrefix)     // Remove unigrams that don't start with the same letters as a valid topping names.
        .map(expandContractions);

    var result_1gram = getMostConfidentToppings(tokens_1gram, threshold);

    return result_1gram.map(function (match) { return match.toppingName; });
}
