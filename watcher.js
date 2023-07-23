const axios = require('axios');
const db = require('./db');
const utils = require('./utils');

let watchInterval;

exports.init = () => {
  watchInterval = setInterval(fetchAlertData, process.env.INTERVAL_MIN * 60 * 1000);
  fetchAlertData();
}

const fetchAlertData = async () => {
  // First, get all alerts
  const alerts = await getAlerts();
  const existingAlerts = db.query('select id, start, end, title, description, color, url from alerts');
  const now = db.getDbDateTime();
  const skipNotifications = existingAlerts.length < 1;
  
  if (!alerts) {
    console.log(`Failed to update alert data at ${new Date()}`);
    return;
  }
  
  // Update the database
  for (alertIndex in alerts) {
    const alert = alerts[alertIndex];
    const start = alert.start ? Date.parse(alert.start) / 1000 : null;
    const end = alert.end ? Date.parse(alert.end) / 1000 : null;
    
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
      if (!skipNotifications) await utils.postNewAlertNotification(alert);
    } else if (existingAlert.start != start || existingAlert.end != end || existingAlert.title != alert.title || existingAlert.description != alert.description) {
      // update existing alert
      const updateResult = db.query('update alerts set start = ?, end = ?, title = ?, description = ?, color = ?, url = ? where id = ?', true, [ start, end, alert.title, alert.description, alert.color, alert.url, alert.id ]);
      if (!skipNotifications) await utils.postChangeNotification(alert);
    } else if (!skipNotifications) {
      // alert didn't change
      // send notification if we are within one update interval of the start or end date
      if (start && now > start && now < start + (process.env.INTERVAL_MIN * 60)) {
        await utils.postStartNotification(alert);
      } else if (end && now < end && now > end - (process.env.INTERVAL_MIN * 60)) {
        await utils.postEndNotification(alert);
      }
    }
  }
  
  // Clean up expired alerts
  for (alertIndex in existingAlerts) {
    const alert = existingAlerts[alertIndex];
    const currentAlert = alerts.find(a => a.id == alert.id);
    
    if (!currentAlert) {
      db.query('delete from alerts where id = ?', true, [ alert.id ]);
      
      // send notification if there is no end date, or if we are within one update interval of the end date
      if (!skipNotifications && (!alert.end || now < alert.end && now > alert.end + (process.env.INTERVAL_MIN * 60))) {
        await utils.postEndNotification(alert);
      }
    }
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
        outputType: 'JSON'
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