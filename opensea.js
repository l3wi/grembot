const fetch = require('isomorphic-fetch')
const Discord = require('discord.js')

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const info = async (contract) => {
  const url = `https://api.opensea.io/api/v1/assets?asset_contract_address=${contract}&order_direction=desc&offset=0&limit=1`
  const response = await fetch(url, {
    method: 'GET', // *GET, POST, PUT, DELETE, etc.
  })
  const data = await response.json()
  return {
    name: data.assets[0].collection.name,
    img: data.assets[0].collection.image_url,
  }
}

const get = async (contract, action) => {
  const url = `https://api.opensea.io/api/v1/events?asset_contract_address=${contract}&event_type=${action}&only_opensea=false&offset=0&limit=40`
  const response = await fetch(url, {
    method: 'GET', // *GET, POST, PUT, DELETE, etc.
  }).catch((e) => console.log(e))
  const data = await response.json()
  if (data.detail) throw 'Rate Limited'
  return data.asset_events
}

const embed = (info, action, item) => {
  const { name } = info

  let event = ''
  switch (action) {
    case 'successful':
      event = 'Sale'
      break
    case 'created':
      event = 'Mint'
      break
    case 'transfer':
      event = 'Transfer'
      break
  }

  let discEmbed = new Discord.MessageEmbed()
    .setColor('#0099ff')
    .setTitle(`${event}: #${item.asset.token_id}`)
    .setURL(item.asset.permalink)
    .setAuthor(name)
    .setThumbnail(item.asset.image_url)
    .setTimestamp()

  switch (action) {
    case 'successful':
      discEmbed
        .addFields(
          {
            name: 'USD price',
            value: `$${numberWithCommas(
              (
                (item.total_price / eval(`1e` + 18)) *
                item.payment_token.usd_price
              ).toFixed(2)
            )}`,
            inline: true,
          },
          {
            name: 'Token price',
            value: `${numberWithCommas(
              (item.total_price / eval(`1e` + 18)).toFixed(2)
            )} ${item.payment_token.symbol}`,
            inline: true,
          },
          {
            name: '\u200B',
            value: '\u200B',
            inline: true,
          }
        )
        .addFields(
          {
            name: 'Seller',
            value: !item.seller.user
              ? item.seller.address.slice(0, 5) + '...'
              : item.seller.user.username,
            inline: true,
          },
          {
            name: 'Buyer',
            value: !item.winner_account.user
              ? item.winner_account.address.slice(0, 5) + '...'
              : item.winner_account.user.username,
            inline: true,
          },
          {
            name: '\u200B',
            value: '\u200B',
            inline: true,
          }
        )
      break
    case 'transfer':
      discEmbed.addFields(
        {
          name: 'From',
          value: item.from_account.user.username,
          inline: true,
        },
        {
          name: 'To',
          value: item.to_account.user.username,
          inline: true,
        },
        {
          name: '\u200B',
          value: '\u200B',
          inline: true,
        }
      )
      break
  }

  return discEmbed
}

module.exports = { info, get, embed }
