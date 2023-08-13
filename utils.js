const axios = require('axios');

exports.isoToDisplay = (iso) => {
  if (!iso) {
    return '';
  }
  
  if (iso.indexOf('T') < 0) {
    iso = `${iso}T00:00:00`;
  }
  
  const options = {
    timeZone: 'America/Chicago',
    month: "numeric",
    day: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "numeric"
  };
  
  const date = new Date(iso);
  
  return date.toLocaleString('en-US', options);
}

exports.isoToEpoch = (iso) => {
  if (!iso) {
    return null;
  }
  
  if (iso.indexOf('T') < 0) {
    iso = `${iso}T00:00:00`;
  }
  
  return Date.parse(iso) / 1000;
}

exports.postToWebhook = async (body) => {
  if (!process.env.WEBHOOK_URL) {
    return;
  }
  
  const webhookUrls = process.env.WEBHOOK_URL.split(';');
  
  for (urlIndex in webhookUrls) {
    try {
      await axios.post(webhookUrls[urlIndex], body);
    } catch (error) {
      console.log('Error posting to webhook', error);
    }
  }
  
  // snooze to prevent rate limiting
  await new Promise(r => setTimeout(r, 2000));
}

exports.buildNewAlertNotification = (alert) => {
  return {
    color: parseInt(alert.color, 16),
    title: alert.description,
    url: alert.url,
    author: {
      name: alert.title,
    },
    fields: [
      {
        name: "Start time",
        value: alert.start ? alert.start : 'TBD',
        inline: true,
      },
      {
        name: "End time",
        value: alert.end ? alert.end : 'TBD',
        inline: true,
      },
    ],
  };
}

exports.buildChangeNotification = (alert) => {
  return {
    color: parseInt(alert.color, 16),
    title: alert.description,
    url: alert.url,
    author: {
      name: `Updated: ${alert.title}`,
    },
    fields: [
      {
        name: "Start time",
        value: alert.start ? alert.start : 'TBD',
        inline: true,
      },
      {
        name: "End time",
        value: alert.end ? alert.end : 'TBD',
        inline: true,
      },
    ],
  };
}

exports.buildStartNotification = (alert) => {
  return {
    color: parseInt(alert.color, 16),
    title: `Starting now: ${alert.description}`,
    url: alert.url,
    author: {
      name: alert.title,
    },
    fields: alert.end ? [
      {
        name: "End time",
        value: alert.end,
        inline: true,
      },
    ] : null,
  };
}

exports.buildEndNotification = (alert) => {
  return {
    color: parseInt(alert.color, 16),
    title: `Ended: ${alert.description}`,
    url: alert.url,
    author: {
      name: `${alert.title} - Ended`,
    },
  };
}

exports.postNotifications = async (alerts) => {
  // Chunk up to ten embeds per post.
  for (let i = 0; i < alerts.length; i += 10) {
    const alertsChunk = alerts.slice(i, i + 10);
    const body = {
      embeds: [ ...alertsChunk ],
    };
    
    await exports.postToWebhook(body);
  }
}