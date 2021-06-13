const fetch = require('isomorphic-fetch')
const Discord = require('discord.js')

const info = async (contract) => {
  const url = `https://api-mainnet.rarible.com/marketplace/api/v1/users/${contract}/marketplace/api/v1/collections`
  const response = await fetch(url, {
    method: 'GET', // *GET, POST, PUT, DELETE, etc.
  })
  const data = await response.json()
  return {
    name: data[0].name,
    img: 'https://ipfs.rarible.com/' + data[0].pic.split('//')[1],
  }
}

const get = async (contract, action, interval) => {
  const body = {
    types: ['MINT'],
    filter: {
      '@type': 'by_user',
      address: contract,
    },
    size: 10,
  }

  const response = await fetch(
    `https://api-mainnet.rarible.com/marketplace/api/v1/activity`,
    {
      method: 'POST', // *GET, POST, PUT, DELETE, etc.
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )
  const data = await response.json()
  return data
}

const embed = (info, action, item) => {
  const { name, img } = info

  let discEmbed = new Discord.MessageEmbed()
    .setColor('#0099ff')
    .setTitle(`Mint: #${item.tokenId}`)
    .setURL(`https://rarible.com/token/${info.contract}:${item.tokenId}`)
    .setThumbnail(img)
    .setAuthor(name)
    .setTimestamp()
  return discEmbed
}

module.exports = { info, get, embed }
