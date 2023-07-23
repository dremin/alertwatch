const axios = require('axios');

exports.isoToDisplay = (iso) => {
  if (!iso) {
    return '';
  }
  
  if (iso.indexOf('T') < 0) {
    return iso;
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

exports.postNewAlertNotification = async (alert) => {
  const body = {
    embeds: [{
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
    }],
  };
  
  await exports.postToWebhook(body);
}

exports.postChangeNotification = async (alert) => {
  const body = {
    embeds: [{
      color: parseInt(alert.color, 16),
      title: alert.description,
      url: alert.url,
      author: {
        name: `${alert.title} - Updated`,
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
    }],
  };
  
  await exports.postToWebhook(body);
}

exports.postStartNotification = async (alert) => {
  const body = {
    embeds: [{
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
    }],
  };
  
  await exports.postToWebhook(body);
}

exports.postEndNotification = async (alert) => {
  const body = {
    embeds: [{
      color: parseInt(alert.color, 16),
      title: `Ended: ${alert.description}`,
      url: alert.url,
      author: {
        name: alert.title,
      },
    }],
  };
  
  await exports.postToWebhook(body);
}