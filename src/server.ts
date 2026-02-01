import { Elysia } from 'elysia'
import { staticPlugin } from '@elysiajs/static'

import { versions, outputDirectory } from './config'

const DCB_MAGIC = new Uint8Array([0xff, 0x44, 0x43, 0x42])
const DCZ_MAGIC = new Uint8Array([0x5e, 0x2a, 0x4d, 0x18, 0x20, 0x00, 0x00, 0x00])

const threeJsScriptMap = await Promise.all(
    versions.map(async version => {
        const uncompressedBuffer = await Bun.file(`${outputDirectory}/${version}.js`).bytes()
        
        const sha256Checksum = new Bun.CryptoHasher("sha256")
        sha256Checksum.update(uncompressedBuffer)
        const hash = ':' + sha256Checksum.digest().toString('base64') + ':'
        
        const compressedBuffer = await Bun.file(`${outputDirectory}/${version}.js.br`).bytes()

        return {
            version,
            hash,
            data: uncompressedBuffer,
            compressed: compressedBuffer,
        }
    })
)

const threeJsDeltaMap = await Promise.all(
    versions.map(async from => {
        return Promise.all(
            versions.map(async to => {
                const sbrBuffer = await Bun.file(`${outputDirectory}/${from}-${to}.js.sbr`).bytes()
                const szstBuffer = await Bun.file(`${outputDirectory}/${from}-${to}.js.szst`).bytes()
                return {
                    from,
                    to,
                    sbr: sbrBuffer,
                    szst: szstBuffer,
                }
            })
        )
    })
)

const threeJsDeltaMapByHash = versions.reduce((acc, from) => {
    const script = threeJsScriptMap.find(s => s.version === from)
    if (script) {
        const deltas = threeJsDeltaMap.flat().filter(d => d.from === from)
        const deltaByVersion = deltas.reduce((versionAcc, delta) => {
            versionAcc[delta.to] = delta
            return versionAcc
        }, {} as Record<string, typeof deltas[0]>)
        const hasher = new Bun.CryptoHasher("sha256")
        hasher.update(script.data)
        acc[script.hash] = {
            hash: hasher.digest(),
            deltas: deltaByVersion,
        }
    }
    return acc
}, {} as Record<string, { hash: Buffer; deltas: Record<string, { from: string; to: string; sbr: Uint8Array; szst: Uint8Array }> }>)

const app = new Elysia()
    .use(staticPlugin({
        prefix: '/',
    }))

for (const version of versions) {
    app.get(`/js/${version}.js`, async ({ request, set }) => {
        set.headers['Content-Type'] = 'application/javascript'
        set.headers['Cache-Control'] = 'public, max-age=1000'
        set.headers['use-as-dictionary'] = 'match="/js/*"'
        set.headers['vary'] = 'available-dictionary'

        const availableDictionary = request.headers.get('available-dictionary')
        const acceptEncodings = request.headers.get('accept-encoding')
            ?.split(',')
            ?.map(item => item.trim()) || []

        const capabilities = {
            dcb:  acceptEncodings.includes('dcb'),
            dcz:  acceptEncodings.includes('dcz'),
        }
        const hasCompressionCapability = Object.values(capabilities).some(cap => cap)

        if (availableDictionary && hasCompressionCapability && threeJsDeltaMapByHash[availableDictionary]) {
            const deltaInfo = threeJsDeltaMapByHash[availableDictionary]
            const delta = deltaInfo.deltas[version]

            if (delta) {
                set.headers['content-dictionary'] = availableDictionary

                if (capabilities.dcz) {
                    set.headers['content-encoding'] = 'dcz'
                    const combined = new Uint8Array(DCZ_MAGIC.length + deltaInfo.hash.length + delta.szst.length)
                    combined.set(DCZ_MAGIC, 0)
                    combined.set(new Uint8Array(deltaInfo.hash), DCZ_MAGIC.length)
                    combined.set(delta.szst, DCZ_MAGIC.length + deltaInfo.hash.length)
                    return combined
                }

                if (capabilities.dcb) {
                    set.headers['content-encoding'] = 'dcb'
                    const combined = new Uint8Array(DCB_MAGIC.length + deltaInfo.hash.length + delta.sbr.length)
                    combined.set(DCB_MAGIC, 0)
                    combined.set(new Uint8Array(deltaInfo.hash), DCB_MAGIC.length)
                    combined.set(delta.sbr, DCB_MAGIC.length + deltaInfo.hash.length)
                    return combined
                }
            }
        }

        const script = threeJsScriptMap.find(s => s.version === version)
        if (script) {
            set.headers['content-encoding'] = 'br'
            return script.compressed
        }

        console.log('returning nothing')
    })
}

app.listen(3000)
console.log(
	`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
)
