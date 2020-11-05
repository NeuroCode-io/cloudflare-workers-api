import Trouter, { HTTPMethod } from 'trouter'

export interface Context {
  waitUntil(p: any): void
  pathParams: {
    [k: string]: string
  }
}

interface Handler {
  (req: Request, ctx: Context): Promise<Response> | Promise<void>
}

interface RouterInput {
  firstHandler?: Handler
  lastHandler?: (req: Request, res: Response, ctx: Context) => Promise<Response>
}

export class Router extends Trouter<Handler> {
  constructor(readonly routerInput?: RouterInput) {
    super()
  }

  middleware(path: string | Handler, ...handlers: Handler[]) {
    if (typeof path === 'function') {
      handlers.unshift(path)
      super.use('/', ...handlers)
    } else {
      super.use(path, ...handlers)
    }
    return this
  }

  async handleRequest(event: FetchEvent) {
    const context = {} as Context
    const { request } = event
    context.waitUntil = event.waitUntil

    if (this.routerInput?.firstHandler) {
      await this.routerInput.firstHandler(request, context)
    }

    const url = new URL(request.url)
    const result = this.find(request.method as HTTPMethod, url.pathname)
    context.pathParams = result.params

    for (let handler of result.handlers) {
      const response = await handler(request, context)
      if (response instanceof Response) {
        if (this.routerInput?.lastHandler) {
          return this.routerInput.lastHandler(request, response, context)
        }
        return response
      }
    }
    return new Response(JSON.stringify({ error: { code: 404, name: 'NotFoundError' } }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
