const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Notes Manager API',
            version: '1.0.0',
        },
    },
    apis: ['./server.js'],
}
module.exports = swaggerOptions;