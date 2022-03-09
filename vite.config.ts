import {createVuePlugin} from "vite-plugin-vue2";
import * as path from "path";
import typescript2 from "rollup-plugin-typescript2"

const config = {
    base: '/',
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/components/index.ts'),
            name: 'DreamingPDF',
            fileName: (format) => `dreamingpdf.${format}.js`,
        },
        rollupOptions: {
            external: ['vue', 'fabric', 'pdf-lib'],
            output: {
                globals: {
                    vue: 'Vue',
                },
            },
        },
    },
    resolve: {
        extensions: ['.ts', '.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
        alias: [
            {
                find: '@/',
                replacement: `${path.resolve(__dirname, './src')}/`,
            },
            {
                find: 'src/',
                replacement: `${path.resolve(__dirname, './src')}/`,
            },
        ],
    },
    plugins: [
        createVuePlugin(),
        typescript2(),
    ],
}


export default config
