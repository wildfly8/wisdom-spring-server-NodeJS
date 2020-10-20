const siteViews = require('../models/visits');

siteViewsUp = () => {
    siteViews.findByIdAndUpdate('5ee99d1119c7f231545d495d', {$inc: {counter: 1}}, {new: true})
    .then((data) => {
            console.log(data.counter)
        })
    .catch((err) => {console.log(err)})
}

module.exports = {siteViewsUp};