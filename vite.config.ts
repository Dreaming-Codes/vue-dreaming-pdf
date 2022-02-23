import {createVuePlugin} from "vite-plugin-vue2";
import * as path from "path";

const config = {
    base: '/',
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/components/index.ts'),
            name: 'DreamingPDF',
            fileName: (format) => `dreamingpdf.${format}.js`,
        },
        rollupOptions: {
            external: ['vue', 'fabric'],
            output: {
                globals: {
                    vue: 'Vue',
                    fabric: 'fabric'
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
        createVuePlugin()
    ],
}


export default config
