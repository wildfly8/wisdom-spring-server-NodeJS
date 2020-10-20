var express = require('express');
var router = express.Router();
const OktaJwtVerifier = require('@okta/jwt-verifier');
const CountryDailyCovidStats = require('../models/CountryDailyCovidStats');
const ProvinceDailyCovidStats = require('../models/ProvinceDailyCovidStats');
const siteViews = require('../models/visits');
const SiteViewsUp = require('../site_analysis/visitsUp');
const sampleConfig = require('../config.js');
const axios = require("axios");
const { response } = require('express');


const oktaJwtVerifier = new OktaJwtVerifier({
  clientId: sampleConfig.resourceServer.oidc.clientId,
  issuer: sampleConfig.resourceServer.oidc.issuer,
  assertClaims: sampleConfig.resourceServer.assertClaims,
  testing: sampleConfig.resourceServer.oidc.testing
});

/**
 * A simple middleware that asserts valid access tokens and sends 401 responses
 * if the token is not present or fails validation.  If the token is valid its
 * contents are attached to req.jwt
 */
const authenticationRequired = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/Bearer (.+)/);
  if (!match) {
    res.status(401);
    return next('Unauthorized');
  }
  const accessToken = match[1];
  const audience = sampleConfig.resourceServer.assertClaims.aud;
  return oktaJwtVerifier.verifyAccessToken(accessToken, audience)
    .then((jwt) => {
      req.jwt = jwt;
      next();
    })
    .catch((err) => {
      res.status(401).send(err.message);
    });
}

const getAllAppUsers = async () => {
  try {
    const { data } = await axios.get(`https://${process.env.OKTA_DOMAIN}/api/v1/apps/${process.env.SPA_CLIENT_ID}/users`, {
      headers: {
        Authorization: `SSWS ${process.env.OKTA_API_TOKEN}`,
      }
     });
    return data.map((user) => user.profile.name);
  } catch (error) {
    console.log(error);
  }
};

router.get('/checkUserLoginStatus', async (req, res) => {
  const name = req.query.name;
  let lastLoginTime = null;
  let lastLogoutTime = null;
  try {
    const responseStart = await axios.get(`https://${process.env.OKTA_DOMAIN}/api/v1/logs?filter=eventType eq "user.session.start" and outcome.result eq "SUCCESS" and actor.displayName eq "${name}"&until=${new Date().toISOString()}&limit=1&sortOrder=DESCENDING`, {
      headers: {
        Authorization: `SSWS ${process.env.OKTA_API_TOKEN}`,
      }
    });
    if(responseStart && responseStart.data && responseStart.data.length > 0) {
      lastLoginTime = responseStart.data[0].published;
    }
    console.log(name + ' lastLoginTime=' + lastLoginTime)
    const responseEnd = await axios.get(`https://${process.env.OKTA_DOMAIN}/api/v1/logs?filter=eventType eq "user.session.end" and outcome.result eq "SUCCESS" and actor.displayName eq "${name}"&until=${new Date().toISOString()}&limit=1&sortOrder=DESCENDING`, {
      headers: {
        Authorization: `SSWS ${process.env.OKTA_API_TOKEN}`,
      }
    });
    if(responseEnd && responseEnd.data && responseEnd.data.length > 0) {
      lastLogoutTime = responseEnd.data[0].published;
    }
    console.log(name + ' lastLogoutTime=' + lastLogoutTime)
  } catch (error) {
    console.log(error);
  }
  if(lastLoginTime && lastLogoutTime && new Date(lastLoginTime) > new Date(lastLogoutTime)) {
    res.json(true)
  } else if(lastLoginTime && !lastLogoutTime) {
    res.json(true)
  } else {
    res.json(false)
  }
});

router.get('/chat', authenticationRequired, async (req, res) => {
  const userSub = req.query.user;
  res.json({
    //list all active users of the app
    allAppUsers: await getAllAppUsers(),
    //temp, need to wait for Cassandra pipeline finished to find all saved rooms for a given user.
    rooms: [
      {
        roomName: 'DM-Shin Xu-Lizzy Xu',
        members: ['Shin Xu', 'Lizzy Xu'],
      },
      {
        roomName: 'DM-Test Account-Shin Xu',
        members: ['Test Account', 'Shin Xu'],
      },
      {
        roomName: 'DM-Test Account-Lizzy Xu',
        members: ['Test Account', 'Lizzy Xu'],
      },
      {
        roomName: 'Channel-Test',
        members: ['Test Account', 'Shin Xu', 'Lizzy Xu'],
      }
    ]
  });
});

router.get('/visitsCounter', async (req, res) => {
  //api source analysis upon user first arrival
  let visitsCounter = 0;
  try {
    SiteViewsUp.siteViewsUp();
     const data = await siteViews.findById('5ee99d1119c7f231545d495d')
     visitsCounter = data.counter;
    res.json(visitsCounter);
  } catch (error) {
      res.status(500).json({message: error.message})
  }
});

router.get('/daily_stats/majorCountries', async (req, res) => {
  //DB call
  try {
    //find top 40 countries with most confirmed cases
    const { lastUpdate } = await CountryDailyCovidStats.findOne({}, {}, {sort: {'lastUpdate': -1}});
    const majorCountries = await CountryDailyCovidStats
      .find({"lastUpdate": {"$gte": new Date(lastUpdate.getFullYear(), lastUpdate.getMonth(), lastUpdate.getDate())}})
      .sort({'confirmed': -1})
      .limit(40);
    res.json(majorCountries.map((country) => country.countryName.replace(/,/g, ';')));
  } catch (error) {
      res.status(500).json({message: error.message})
  }
});

router.get('/daily_stats', async (req, res) => {
  //DB call
  try {
    const names = req.query.countryNames.split(',');
    let allDailyStats = [];
    for(const name of names) {
      allDailyStats.push(await CountryDailyCovidStats.find({countryName: name.replace(/;/g, ',')}));
    }
    res.json(allDailyStats);
  } catch (error) {
      res.status(500).json({message: error.message})
  }
});

let allDailyProvinceStatsAll = {};

router.get('/daily_stats/province', async (req, res) => {
  //DB call
  try {
    const names = req.query.countryNames.split(',');
    const pageNumber = parseInt(req.query.pageNumber);
    if(pageNumber === 0) {
      for(const name of names) {
        let allDailyProvinceStats = [];
        const allStatsForCountryQuery = ProvinceDailyCovidStats.find({countryName: name.replace(/;/g, ',')});
        const allStatsForCountry = await allStatsForCountryQuery.exec();
        const provinces = await allStatsForCountryQuery.distinct('province').exec();
        for(const province of provinces) {
          allDailyProvinceStats.push(allStatsForCountry.filter(doc => doc.province === province));
        };
        allDailyProvinceStats.sort((a, b) => b[b.length - 1].confirmed - a[a.length - 1].confirmed);
        allDailyProvinceStatsAll[name] = allDailyProvinceStats
      }
    }
    let paginatedResult = []
    const screenRows = 10
    for(const name of names) {
      if((pageNumber + 1) * screenRows  - 1 <= (allDailyProvinceStatsAll[name].length - 1)) {
        paginatedResult = allDailyProvinceStatsAll[name].slice(pageNumber * screenRows, (pageNumber + 1) * screenRows)
      } else if(pageNumber * screenRows <= (allDailyProvinceStatsAll[name].length - 1)) {
        paginatedResult = allDailyProvinceStatsAll[name].slice(pageNumber * screenRows)
      }
    }
    res.json(paginatedResult)
  } catch (error) {
      res.status(500).json({message: error.message})
  }
});

module.exports = router;
