const mongoose = require('mongoose');

const ProvinceDailyCovidStatsSchema = new mongoose.Schema(
  {
    countryName: String,
    countrySlug: String,
    countryCode: String,
    province: String,
    confirmed: Number,
    recovered: Number,
    deaths: Number,
    otherDetails: {
      negative: Number,
      pending: Number,
      hospitalizedCurrently: Number,
      hospitalizedCumulative: Number,
      inIcuCurrently: Number,
      inIcuCumulative: Number,
      onVentilatorCurrently: Number,
      onVentilatorCumulative: Number,
      positiveIncrease: Number,
      negativeIncrease: Number,
      deathIncrease: Number,
      hospitalizedIncrease: Number,
      totalTestResults: Number,
      totalTestResultsIncrease: Number,
    },
    lastUpdate: { type: Date, default: Date.now },
  }
);

module.exports = mongoose.model('ProvinceDailyCovidStats', ProvinceDailyCovidStatsSchema, 'province_daily_stats');