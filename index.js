require('dotenv').config()
const path = require('path')
const Discord = require('discord.js')
const fetch = require('isomorphic-fetch')
const flatCache = require('flat-cache')
const OpenSea = require('./opensea.js')
const Rarible = require('./rarible.js')

const client = new Discord.Client()

// init subscription list
let subs = {}
var cache = flatCache.load('settings')
const update = () => {
  cache.setKey('subs', subs)
  cache.save()
}

const prefix = '$'

client.on('ready', async () => {
  // Fetch sub list once loaded
  const savedSubs = cache.getKey('subs')
  if (!savedSubs) return
  subs = savedSubs
  console.log(subs)
  //////////////
  // Setup Buffer
  console.log('Initializing buffer')
  let buffer = await groupFetch(subs)

  //////////////
  // Start watching the various subs
  const interval = 20000

  setInterval(async () => {
    var d = new Date()
    var n = d.toLocaleTimeString()
    console.log('Fetching subs: ', n)

    const data = await groupFetch(subs)
    const oldData = JSON.parse(JSON.stringify(buffer))
    buffer = data

    let newData = {}

    Object.entries(data).map((obj) => {
      const event = obj[1].filter(
        (v, i) =>
          !oldData[obj[0]].some((t) => {
            if (t.transaction) {
              return (
                t.transaction.transaction_hash ===
                v.transaction.transaction_hash
              )
            } else {
              return t.id === v.id
            }
          })
      )
      newData[obj[0]] = event
    })
    Object.entries(newData).map((obj) => {
      const key = obj[0]
      const value = obj[1]
      if (value.length === 0) return

      const info = subs[key.split('-')[0]]
      value.map(async (item, i) => {
        if (key.split('-')[1] === 'mint') {
          const embed = Rarible.embed(info, key.split('-')[1], item)
          client.channels.cache.get(info.channel).send({ embed: embed })
        } else {
          const embed = OpenSea.embed(info, key.split('-')[1], item)
          client.channels.cache.get(info.channel).send({ embed: embed })
        }
      })
    })
  }, interval)
})

const groupFetch = async (subs) => {
  let events = {}
  // generate list of requests to execute
  let calls = []
  Object.values(subs).map((item) => {
    item.actions.map((action) => {
      calls.push({ contract: item.contract, action })
    })
  })

  // execute delayed calls
  const promises = calls.map(
    (call, i) =>
      new Promise((resolve) =>
        setTimeout(() => {
          if (call.action != 'mint') {
            OpenSea.get(call.contract, call.action).then((response) => {
              resolve(response)
            })
          } else {
            Rarible.get(call.contract, call.action).then((response) => {
              resolve(response)
            })
          }
        }, 1000 * calls.length - 1000 * i)
      )
  )
  const info = await Promise.all(promises)
  calls.map((item, i) => (events[item.contract + '-' + item.action] = info[i]))
  return events
}

client.on('message', async (message) => {
  if (message.author.bot) return
  if (!message.content.startsWith(prefix)) return

  const commandBody = message.content.slice(prefix.length)
  const args = commandBody.split(' ')
  const command = args.shift().toLowerCase()

  if (command === 'help') {
    return message.reply(
      `I hear you want some help! These are the following commands you can use:\n 
      \`$list\`: this will list all the current subscriptions\n
      \`$add <contract> <action>\`: this will add a subscription to a contract for a specific action on OpenSea\n
      \`$remove <contract>\`: removes all subscriptions from that contract\n
      \`$restart\`: kills the bot and starts it again`
    )
  } else if (command === 'list') {
    Object.values(subs).map((item) => {
      const channel = client.channels.cache.get(item.channel).name

      const embed = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle(item.name)
        .setAuthor(item.contract)
        .setThumbnail(item.img)
        .addFields(
          {
            name: 'Watching',
            value: item.actions.join(),
            inline: true,
          },
          {
            name: 'Channel',
            value: channel,
            inline: true,
          },
          {
            name: '\u200B',
            value: '\u200B',
            inline: true,
          }
        )

      client.channels.cache.get(message.channel.id).send({ embed: embed })
    })

    // client.channels.cache.get(process.env.APE).send({ embed: embed })
  } else if (command === 'subscribe' || command === 'add') {
    // Validation
    if (args.length != 2)
      return message.reply(
        `Incorrect arguments length. Only 2 args allowed: <contract> <action>`
      )

    if (!['successful', 'mint', 'transfer'].some((item) => item === args[1]))
      return message.reply(
        `Action not supported! Please choose from 'mint', 'successful', & 'transfer'`
      )

    if (subs[args[0]]) {
      // Check if the contract is being watched
      console.log('Already subbed')
      subs[args[0]].actions.push(args[1])
    } else {
      if (args[1] === 'mint') {
        const { name, img } = await Rarible.info(args[0])
        console.log(img)
        const subscription = {
          contract: args[0],
          actions: [args[1]],
          channel: message.channel.id,
          name,
          img,
        }
        subs[args[0]] = subscription
        console.log(subs)
      } else {
        const { name, img } = await OpenSea.info(args[0])
        const subscription = {
          contract: args[0],
          actions: [args[1]],
          channel: message.channel.id,
          name,
          img,
        }
        subs[args[0]] = subscription
        console.log(subs)
      }
    }
    message.reply(`Yep! Now watching ${subs[args[0]].name} for ${args[1]}s `)
    update()
    await groupFetch(subs)
  } else if (command === 'unsubscribe' || command === 'remove') {
    if (args.length != 1)
      return message.reply(
        `Incorrect arguments length. Only 1 args allowed: <contract>`
      )
    message.reply(`Removed all subscriptions for ${subs[args[0]].name}`)
    delete subs[args[0]]
    update()
  } else if (command === 'restart') {
    message.reply(`Bye Felica...`)
    process.exit()
  }
})

client.login(process.env.TOKEN)
