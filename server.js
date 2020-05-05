const http = require('http');
const Koa = require('koa');
const Router = require('koa-router');
const { streamEvents } = require('http-event-stream');
const uuid = require('uuid');
const app = new Koa();

app.use(async (ctx, next) => {
  const origin = ctx.request.get('Origin');
  if (!origin) {
    return await next();
  }

  const headers = { 'Access-Control-Allow-Origin': '*', };

  if (ctx.request.method !== 'OPTIONS') {
    ctx.response.set({ ...headers });
    try {
      return await next();
    } catch (e) {
      e.headers = { ...e.headers, ...headers };
      throw e;
    }
  }

  if (ctx.request.get('Access-Control-Request-Method')) {
    ctx.response.set({
      ...headers,
      'Access-Control-Allow-Methods': 'GET, POST, PUD, DELETE, PATCH',
    });

    if (ctx.request.get('Access-Control-Request-Headers')) {
      ctx.response.set('Access-Control-Allow-Headers', ctx.request.get('Access-Control-Request-Headers'));
    }

    ctx.response.status = 204;
  }
});

const router = new Router();
const archiveLength = 50;
const archiveMessages = [
  {
    event: 'gameReport',
    data: JSON.stringify({
      type: 'action',
      message: 'Игра началась',
      date: new Date(),
    }),
    id: uuid.v4()
  }
];



const allowedMessages = [
  {
    type: 'action',
    message: 'Идёт перемещение мяча по полю, игроки и той, и другой команды активно пытаются атаковать'
  },
  {
    type: 'freekick',
    message: 'Нарушение правил, будет штрафной удар'
  },
  {
    type: 'goal',
    message: 'Отличный удар! И Г-О-Л!'
  }
]

const intervals = setInterval(() => { 
  
  let targetIndex = 0;
  const generatedIndex = Math.floor(Math.random() * 10);
  if (generatedIndex < 6) {
    targetIndex = 0;
  } else if (generatedIndex === 6) {
    targetIndex = 2;
  } else {
    targetIndex = 1;
  }

  const newMessageData = allowedMessages[targetIndex];
  newMessageData.date = new Date();
  
  const newMessage = {
    event: 'gameReport',
    data: JSON.stringify(newMessageData),
    id: uuid.v4()
  };

  archiveMessages.push(newMessage);

  if (archiveMessages.length + 1> archiveLength) clearInterval(intervals);
}, 5000);

router.get('/sse', async (ctx) => {
  console.log('start sse');
  streamEvents(ctx.req, ctx.res, {
    async fetch(lastEventId) {
      console.log(lastEventId);
      return [];
    },
    stream(sse) {
      let sendedMessages = 0;
      const interval = setInterval(() => {
        if(archiveMessages.length > sendedMessages) {
          sse.sendEvent(archiveMessages[sendedMessages]);
          sendedMessages += 1;
        }

        if (sendedMessages > archiveLength) clearInterval(interval);
      }, 10);

      return () => clearInterval(interval);
    }
  });

  ctx.respond = false;
});

router.get('/index', async (ctx) => {
  ctx.response.body = 'hello';
});

app.use(router.routes()).use(router.allowedMethods());

const port = process.env.PORT || 7070;
const server = http.createServer(app.callback())
server.listen(port);
