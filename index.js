import chokidar from 'chokidar'
import rest from 'restler'
import config from 'config'
import exec_queue from './exec-queue'
import handbrake from './handbrake'

console.dir(config)
const event = config.event

const queue = exec_queue()
const encode = handbrake()

function dispatch(e){
  console.log(`event: ${e.name} ${e.status} ${e.result.path}`)
  const sender = event[e.name] && event[e.name][e.status]
  if (sender && sender.url){
    const url = config.env[sender.url] || sender.url
    console.log(`dispatch: ${url}`)
    rest.postJson(url, e)
      .on('error', (err, res)=>{
        console.log(`dispatch: ${url} ERROR`)
        console.dir({err, res})
      })
  }
  if (sender && sender.exec){
    const exec = config.env[sender.exec] || sender.exec
    queue.push({event: e, exec, dispatch})
  }
  if (sender && sender.handbrake){
    encode.push({event: e, options: sender.handbrake, dispatch})
  }
}

function cutTail(str, keyword){
  const splited = str.split(keyword)
  return splited[splited.length - 1]
}

function watch(name, watcher){
  const watchpath = config.env[watcher.path] || watcher.path
  console.log(`監視します: ${name} ${watchpath}`)
  chokidar.watch(watchpath, {ignored: /[\/\\]\./, persistent: true})
    .on('error', (error)=>{
      console.log('watch: ERROR')
      console.dir(error)
      dispatch({
        name,
        status: 'watch_error',
        result: {error},
      })
    })
    .on('all', (event, path)=>{
      const filename = cutTail(path, '/')
      dispatch({
        name,
        status: event,
        result: {path, filename},
      })
    })
}

for (let name in event){
  watch(name, event[name])
}