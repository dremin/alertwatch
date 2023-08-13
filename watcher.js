const axios = require('axios');
const db = require('./db');
const utils = require('./utils');

let watchInterval;
let updateInFlight = false;

exports.init = () => {
  watchInterval = setInterval(performFetch, process.env.INTERVAL_MIN * 60 * 1000);
  performFetch();
}

const performFetch = async () => {
  if (updateInFlight) {
    return;
  }
  updateInFlight = true;
  
  try {
    await fetchAlertData();
  } catch (error) {
    console.error('Unable to fetch alert data', error);
  }
  
  updateInFlight = false;
}

const fetchAlertData = async () => {
  // First, get all alerts
  const alerts = await getAlerts();
  const existingAlerts = db.query('select id, start, end, title, description, color, url from alerts');
  const now = db.getDbDateTime();
  const skipNotifications = existingAlerts.length < 1;
  let alertNotifications = [];
  
  if (!alerts) {
    console.log(`Failed to update alert data at ${new Date()}`);
    return;
  }
  
  // Update the database
  for (alertIndex in alerts) {
    const alert = alerts[alertIndex];
    const start = utils.isoToEpoch(alert.start);
    const end = utils.isoToEpoch(alert.end);
    
    if (alert.start) {
      alert.start = utils.isoToDisplay(alert.start);
    }
    
    if (alert.end) {
      alert.end = utils.isoToDisplay(alert.end);
    }
    
    const existingAlert = existingAlerts.find(a => a.id == alert.id);
    
    if (!existingAlert) {
      // missing row -> new alert!
      db.query('insert into alerts (id, start, end, title, description, color, url) values (?, ?, ?, ?, ?, ?, ?)', true, [ alert.id, start, end, alert.title, alert.description, alert.color, alert.url ]);
      alertNotifications.push(utils.buildNewAlertNotification(alert));
    } else if (existingAlert.start != start || existingAlert.end != end || existingAlert.title != alert.title || existingAlert.description != alert.description) {
      // update existing alert
      const updateResult = db.query('update alerts set start = ?, end = ?, title = ?, description = ?, color = ?, url = ? where id = ?', true, [ start, end, alert.title, alert.description, alert.color, alert.url, alert.id ]);
      alertNotifications.push(utils.buildChangeNotification(alert));
    } else {
      // alert didn't change
      // send notification if we are within one update interval of the start or end date
      // disabled, seemed a bit chatty
      /*if (start && now > start && now < start + (process.env.INTERVAL_MIN * 60)) {
        alertNotifications.push(utils.buildStartNotification(alert));
      } else if (end && now < end && now > end - (process.env.INTERVAL_MIN * 60)) {
        alertNotifications.push(utils.buildEndNotification(alert));
      }*/
    }
  }
  
  // Clean up expired alerts
  for (alertIndex in existingAlerts) {
    const alert = existingAlerts[alertIndex];
    const currentAlert = alerts.find(a => a.id == alert.id);
    
    if (!currentAlert) {
      db.query('delete from alerts where id = ?', true, [ alert.id ]);
      
      // send notification if there was no end date
      if (!alert.end) {
        // disabled, seemed a bit chatty
        // alertNotifications.push(utils.buildEndNotification(alert));
      }
    }
  }
  
  if (!skipNotifications && alertNotifications.length > 0) {
    await utils.postNotifications(alertNotifications);
  }
  
  console.log(`Updated alert data at ${new Date()}`);
}

const getAlerts = async () => {
  let alerts = [];
  const alertsResponse = await alertsRequest();
  
  alerts = alertsResponse?.CTAAlerts?.Alert?.map(alert => ({
    id: alert.AlertId,
    title: alert.Headline,
    description: alert.ShortDescription,
    color: alert.SeverityColor,
    url: alert.AlertURL ? alert.AlertURL['#cdata-section'] : null,
    start: alert.EventStart,
    end: alert.EventEnd,
  }));
  
  return alerts;
}

const alertsRequest = async () => {
  try {
    const response = await axios.get(`https://lapi.transitchicago.com/api/1.0/alerts.aspx`, {
      params: {
        outputType: 'JSON',
        accessibility: false,
      }
    });
    
    if (response.status === 200) {
      return response.data;
    }
  } catch (error) {
    console.error(error);
  }
  
  return {};
}