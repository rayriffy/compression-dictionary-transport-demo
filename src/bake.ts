import { $ } from "bun"
import { versions, outputDirectory } from "./config"

// clean output directory
await $`rm -rf ${outputDirectory}/*.js`.nothrow()
await $`rm -rf ${outputDirectory}/*.br`.nothrow()
await $`rm -rf ${outputDirectory}/*.sbr`.nothrow()
await $`rm -rf ${outputDirectory}/*.szst`.nothrow()

// download all versions of three.js
await Promise.all(
    versions.map(version =>
        $`curl https://unpkg.com/three@0.${version}.0/build/three.module.js -o ${outputDirectory}/${version}.js`.quiet()
    )
)

// compress all into regular brotil
const regularBrotilPromises = versions.map(version =>
    $`brotli ${outputDirectory}/${version}.js -o ${outputDirectory}/${version}.js.br`
)

// generate diff of brotil in all versions including itself
const diffBrotilPromises = versions.map(sourceVersion =>
    versions.map(targetVersion =>
        $`brotli ${outputDirectory}/${targetVersion}.js -D ${outputDirectory}/${sourceVersion}.js -o ${outputDirectory}/${sourceVersion}-${targetVersion}.js.sbr`
    )
).flat()

// generate diff of zstd in all versions
const diffZstdPromises = versions.map(sourceVersion =>
    versions.map(async targetVersion => {
        if (sourceVersion === targetVersion) {
            // make it's own copy to compare with itself
            await $`cp ${outputDirectory}/${sourceVersion}.js ${outputDirectory}/_${sourceVersion}.js`

            // do initial compression
            await $`zstd ${outputDirectory}/${sourceVersion}.js -D ${outputDirectory}/_${sourceVersion}.js -19 -o ${outputDirectory}/${sourceVersion}-${sourceVersion}.js.szst`

            // cleanup
            await $`rm ${outputDirectory}/_${sourceVersion}.js`
        }
        else {
            await $`zstd ${outputDirectory}/${targetVersion}.js -D ${outputDirectory}/${sourceVersion}.js -19 -o ${outputDirectory}/${sourceVersion}-${targetVersion}.js.szst`
        }
    })
).flat()

await Promise.all([
    ...regularBrotilPromises,
    ...diffBrotilPromises,
    ...diffZstdPromises
])
