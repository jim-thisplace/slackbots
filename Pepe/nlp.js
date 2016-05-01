function getEditDistance(a, b) {
    if (a.length == 0) return b.length;
    if (b.length == 0) return a.length;

    var matrix = [];

    // increment along the first column of each row
    var i;
    for (i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // increment each column in the first row
    var j;
    for (j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (i = 1; i <= b.length; i++) {
        for (j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1)); // deletion
            }
        }
    }

    return matrix[b.length][a.length];
}

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
        .slice()
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

function getMostConfident(tokens) {
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
 * Test for if a token is a valid pizza name.
 * @type {RegExp}
 */
var VALID_PIZZA_NAME_PREFIX = new RegExp(
    '^(' + PIZZA_BASE.map(function (name) {
        return name.substr(0, 3);
    }).join('|') + ')'
);

function isValidPizzaNamePrefix(token) {
    return VALID_PIZZA_NAME_PREFIX.test(token);
}

// Filter to replace "connecting words"
var USELESS_WORD = new RegExp([
    'please',
    'pls',
    'and',
    'the'
].join('|'));

function isNotUselessWord(token) {
    return !USELESS_WORD.test(token);
}

// todo: func to replace n-grams from whitelist with hyphenated versions
var CONTRACTIONS = {
    'marg' : 'margherita'
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

    var result_1gram = getMostConfident(valid_tokens_1gram);

    if (result_1gram.confidence < 0.8) { // confidence threshold
        if (tokens_2gram.length > 0) {
            var result_2gram = getMostConfident(tokens_2gram);

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

function getPizzaToppings(pizzaRequestText) {
    var normalizedText = pizzaRequestText
        .toLowerCase()
        .split(/with/)[1];  // discard toppings (any words before "with")

}
