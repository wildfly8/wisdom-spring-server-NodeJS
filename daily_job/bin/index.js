#!/usr/bin/env node

const mongoose = require('mongoose');
const { default: axios } = require('axios');
const CountryDailyCovidStats = require('./CountryDailyCovidStats.js')
const ProvinceDailyCovidStats = require('./ProvinceDailyCovidStats.js')
const url = "https://api.covid19api.com";
const url2 = "https://covidtracking.com/api/states/daily";
const url3 = "https://covidtracking.com/api/us/daily";
const DB_NAME = 'covid19';

(async () => {
    let conn = null;
    try {
        //open MongoDB covid19 db connection
        await mongoose.connect('mongodb://localhost/' + DB_NAME, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('MongoDB covid19 db connected successfully.');
        conn = mongoose.connection;
        conn.on('error', (error) => console.error(error));
        conn.once('open', () => console.log('Opened DB connection'));
        conn.once('close', () => console.log('Closed DB connection'));
        conn.db.listCollections({name: 'country_daily_stats'}).next(function(err, allCollectionNames) {
        if (allCollectionNames) {
            if (err) {
                console.log(err);
                return;
            }
            CountryDailyCovidStats.collection.drop();
            console.log('Collection country_daily_stats has been dropped successfully.');
        }
        });
        conn.db.listCollections({name: 'province_daily_stats'}).next(function(err, allCollectionNames) {
            if (allCollectionNames) {
                if (err) {
                    console.log(err);
                    return;
                }
                ProvinceDailyCovidStats.collection.drop();
                console.log('Collection province_daily_stats has been dropped successfully.');
            }
        });

        //fetch api for all countries and provinces
        const allCountries = await fetchCountries();
        for(const { Country, Slug, ISO2 } of allCountries) {
            try {
                //init daily country stats job
                if(Slug === 'united-states') {
                    let allDailyRawStats = await fetchAllDailyStatsForUS();
                    allDailyRawStats.reverse();
                    const allDailyStats = allDailyRawStats.map(({ positive, death, recovered, dateChecked, negative, pending, hospitalizedCurrently, hospitalizedCumulative, inIcuCurrently, inIcuCumulative, onVentilatorCurrently, onVentilatorCumulative, positiveIncrease, negativeIncrease, deathIncrease, hospitalizedIncrease, totalTestResults, totalTestResultsIncrease }) => {
                        return new CountryDailyCovidStats({countryName: Country, countrySlug: Slug, countryCode: ISO2, confirmed: positive, recovered: recovered, deaths: death, lastUpdate: dateChecked,
                            otherDetails: {
                                negative: negative,
                                pending: pending,
                                hospitalizedCurrently: hospitalizedCurrently,
                                hospitalizedCumulative: hospitalizedCumulative,
                                inIcuCurrently: inIcuCurrently,
                                inIcuCumulative: inIcuCumulative,
                                onVentilatorCurrently: onVentilatorCurrently,
                                onVentilatorCumulative: onVentilatorCumulative,
                                positiveIncrease: positiveIncrease,
                                negativeIncrease: negativeIncrease,
                                deathIncrease: deathIncrease,
                                hospitalizedIncrease: hospitalizedIncrease,
                                totalTestResults: totalTestResults,
                                totalTestResultsIncrease: totalTestResultsIncrease,
                            }
                        });
                    }).filter((ele) => ele.lastUpdate != null);
                    await CountryDailyCovidStats.collection.insertMany(allDailyStats);
                } else {
                    const allDailyRawStats = await fetchAllDailyStatsForCountry(Slug);
                    const allDailyStats = allDailyRawStats.map(({ Country, Confirmed, Deaths, Recovered, Date }) => {
                        return new CountryDailyCovidStats({countryName: Country, countrySlug: Slug, countryCode: ISO2, confirmed: Confirmed, recovered: Recovered, deaths: Deaths, lastUpdate: Date});
                    });
                    await CountryDailyCovidStats.create(allDailyStats);
                }
                console.log(Slug + ' saved to country_daily_stats collection.');

                //init daily province stats job
                if(Slug === 'united-states') {
                    let allDailyRawProvinceStats = await fetchUSAllDailyStatsForProvince(Slug);
                    allDailyRawProvinceStats.reverse();
                    const allDailyProvinceStats = allDailyRawProvinceStats.map(({ state, positive, death, recovered, dateChecked, negative, pending, hospitalizedCurrently, hospitalizedCumulative, inIcuCurrently, inIcuCumulative, onVentilatorCurrently, onVentilatorCumulative, positiveIncrease, negativeIncrease, deathIncrease, hospitalizedIncrease, totalTestResults, totalTestResultsIncrease }) => {
                        return new ProvinceDailyCovidStats({countryName: Country, countrySlug: Slug, countryCode: ISO2, province: state, confirmed: positive, recovered: recovered, deaths: death, lastUpdate: dateChecked,
                            otherDetails: {
                                negative: negative,
                                pending: pending,
                                hospitalizedCurrently: hospitalizedCurrently,
                                hospitalizedCumulative: hospitalizedCumulative,
                                inIcuCurrently: inIcuCurrently,
                                inIcuCumulative: inIcuCumulative,
                                onVentilatorCurrently: onVentilatorCurrently,
                                onVentilatorCumulative: onVentilatorCumulative,
                                positiveIncrease: positiveIncrease,
                                negativeIncrease: negativeIncrease,
                                deathIncrease: deathIncrease,
                                hospitalizedIncrease: hospitalizedIncrease,
                                totalTestResults: totalTestResults,
                                totalTestResultsIncrease: totalTestResultsIncrease,
                            }
                        });
                    }).filter((ele) => ele.lastUpdate != null);
                    await ProvinceDailyCovidStats.collection.insertMany(allDailyProvinceStats);
                } else {
                    const allDailyRawProvinceStats = await fetchAllDailyStatsForProvince(Slug);
                    const allDailyProvinceStats = allDailyRawProvinceStats.map(({ Country, Province, Confirmed, Deaths, Recovered, Date }) => {
                        return new ProvinceDailyCovidStats({countryName: Country, countrySlug: Slug, countryCode: ISO2, province: Province, confirmed: Confirmed, recovered: Recovered, deaths: Deaths, lastUpdate: Date});
                    });
                    await ProvinceDailyCovidStats.create(allDailyProvinceStats);
                }
                console.log(Slug + ' saved to province_daily_stats collection.');

                //daily append job
                // const allDailyRawStats = await fetchAllDailyStatsForCountry(Slug);
                // if(allDailyRawStats && allDailyRawStats.length > 0) {
                //     const { Country, Confirmed, Recovered, Deaths, Date: apiDate } = allDailyRawStats[allDailyRawStats.length - 1];
                //     const {lastUpdate} = await CountryDailyCovidStats.findOne({}, {}, {sort: {'lastUpdate': -1}});
                //     const lastUpdateDB = new Date(lastUpdate);
                //     const lastUpdateAPI = new Date(apiDate);
                //     lastUpdateAPI.setHours(0, 0, 0, 0);
                //     lastUpdateDB.setHours(0, 0, 0, 0);
                //     if(lastUpdateAPI > lastUpdateDB) {
                //         const newDailyStats = new CountryDailyCovidStats({countryName: Country, countrySlug: Slug, countryCode: ISO2, confirmed: Confirmed, recovered: Recovered, deaths: Deaths, lastUpdate: new Date(apiDate)});
                //         await newDailyStats.save();
                //         console.log(Slug + ' appended to country_daily_stats collection.');
                //     } else {
                //         console.log(Slug + ' skipped.');   
                //     }
                // }
            } catch (err) {
                console.log(Slug + ' error: ' + err);
                continue;
            }
        } 
    } catch (err) {
        console.log('error: ' + err);
    } finally {
        if(conn != null) {
            conn.close();
        }
        console.log("daily_job finished successfully.")
    }
  })();

const fetchCountries = async () => {
    try {
        const {data} = await axios.get(`${url}/countries`);
        return data;
    } catch (error) {
        console.log(error);
    }
}

const fetchAllDailyStatsForCountry = async (countrySlug) => {
    try {
        const {data} = await axios.get(`${url}/total/country/${countrySlug}`);
        return data;
    } catch (error) {
        console.error(error);
    }
}

const fetchAllDailyStatsForUS = async () => {
    try {
        const {data} = await axios.get(url3);
        return data;
    } catch (error) {
        console.error(error);
    }
}

const fetchAllDailyStatsForProvince = async (countrySlug) => {
    try {
        const {data} = await axios.get(`${url}/dayone/country/${countrySlug}`);
        return data;
    } catch (error) {
        console.error(error);
    }
}

const fetchUSAllDailyStatsForProvince = async (countrySlug) => {
    try {
        const {data} = await axios.get(url2);
        return data;
    } catch (error) {
        console.error(error);
    }
}

process.on('exit', function(code) {
    return console.log(`About to exit with code ${code}`);
});
