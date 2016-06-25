import chokidar from 'chokidar'
import rest from 'restler'
import config from 'config'

console.dir(config)
const event = config.event

function dispatch(e){
  console.log(`event: ${e.name} ${e.status} ${e.result.path}`)
  const sender = event[e.name] && event[e.name][e.status]
  if (sender && sender.url){
    console.log(`dispatch: ${sender.url}`)
    rest.postJson(sender.url, e)
      .on('error', (err, res)=>{
        console.log('dispatch: ERROR')
        console.dir({err, res})
      })
  }
}

function cutTail(str, keyword){
  const splited = str.split(keyword)
  return splited[splited.length - 1]
}

function watch(name, watcher){
  console.log(`監視します: ${name} ${watcher.path}`)
  chokidar.watch(watcher.path, {ignored: /[\/\\]\./, persistent: true})
    .on('error', (error)=>{
      console.log('watch: ERROR')
      console.dir(error)
      dispatch({
        name,
        status: 'error',
        result: {error},
      })
    })
    .on('all', (event, path)=>{
      const filename = cutTail(path, '/')
      const extension = cutTail(filename, '.')
      dispatch({
        name,
        status: event,
        result: {path, filename, extension},
      })
    })
}

for (let name in event){
  watch(name, event[name])
}