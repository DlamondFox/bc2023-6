const express = require('express');
const multer = require('multer');
const swaggerUi = require('swagger-ui-express');
const swaggerOptions = require('./swagger');
const swaggerJsDoc = require('swagger-jsdoc');
const fs = require("fs");
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;
const specs = swaggerJsDoc(swaggerOptions);

app.use(express.static(path.join(__dirname, 'static')));
app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use(bodyParser.raw({type: 'text/plain'}));
app.use(bodyParser.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

const savePhotoInfo = (photoInfo) => {
    let photos;
    try {
        const fileContent = fs.readFileSync('photos.json', 'utf-8');
        photos = JSON.parse(fileContent);
    }
    catch (error) {
        photos = {};
    }
    const photoWithDefaults = {
        identifier: photoInfo.identifier,
        name: photoInfo.name,
        description: photoInfo.description,
        serialNumber: photoInfo.serialNumber,
        manufacturer: photoInfo.manufacturer,
        filename: photoInfo.filename,
        usage: 'no used',
        user: 'available',
    };
    photos.devices?.push(photoWithDefaults);
    fs.writeFileSync('photos.json', JSON.stringify(photos, null, 2), 'utf-8');
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({storage: storage});
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Header', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

/**
 * @swagger
 * /photo-info:
 *      get:
 *          summary: Get information about photos
 *          description: Retrieve information about all photos or a specific photo by identifier.
 *          parameters: 
 *              - in: query
 *                name: identifier
 *                description: Identifier of the photo
 *                required: false
 *                schema:
 *                  type: string
 *          responses:
 *              '200':
 *                  description: Successful response.
 *              '404':
 *                  description: Photo not found.
 */

app.get('/photo-info/', (req, res) => {
    const filePath = 'photos.json';
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(fileContent);
        const identifier = req.query.identifier || req.query.id;
        if (identifier) {
            const selectedDevice = data.devices.find(device => device.identifier === identifier);
            if (selectedDevice) {
                const deviceInfo = {
                    identifier: selectedDevice.identifier,
                    name: selectedDevice.name,
                    description: selectedDevice.description,
                    serialNumber: selectedDevice.serialNumber,
                    manufacturer: selectedDevice.manufacturer,
                };
                res.json(deviceInfo);
            }
            else {
                res.status(404).json({error: 'Device not found'});
            }
        }
        else {
            const deviceInfo = data.devices.map(device => {
                return {
                    identifier: device.identifier,
                    name: device.name,
                    description: device.description,
                    serialNumber: device.serialNumber,
                    manufacturer: device.manufacturer,
                };
            });
            res.json(deviceInfo);
        }
    }
    catch (error) {
        console.error('Error during reading the data from the file', error);
        res.status(500).json({error: 'Internal server error'})
    }
});

/**
 * @openapi
 * /show_photo/:
 *      get:
 *          summary: Get photo by identifier
 *          description: Retrieve the image file of a device by its identifier.
 *          parameters: 
 *              - in: query
 *                name: identifier
 *                description: Device identifier
 *                required: true
 *                schema:
 *                  type: string
 *          responses:
 *              '200':
 *                  description: Successful response. Returns the image file.
 *              '400':
 *                  description: Bad request. Identifier not provided.
 *              '404':
 *                  description: Not found. Device not found.
 *              '500':
 *                  description: Internal server error.
 */

app.get('/show_photo/', (req, res) => {
    try {
        const jsonData = fs.readFileSync('photos.json', 'utf-8');
        const data = JSON.parse(jsonData);
        const identifier = req.query.identifier || req.query.id;
        if (identifier) {
            const selectedDevice = data.devices.find(device => device.identifier === identifier);
            if (selectedDevice) {
                const imagePath = path.join(__dirname, 'uploads', selectedDevice.filename);
                res.setHeader('Content-Type', 'image/jpg');
                res.sendFile(imagePath, (err) => {
                    if (err) {
                        console.error('Error sending image file:', err);
                        res.status(500).json({error: 'Internal server error'});
                    }
                });
            }
            else {
                res.status(404).json({error: 'Device not found'})
            }
        }
        else {
            res.status(400).json({error: 'Identifier not provided in the query parameters'});
        }
    }
    catch (error) {
        console.error('Error:', error);
        res.status(500).json({error: 'Internal server error'})
    }
});

/**
 * @openapi
 * /add_user:
 *      post:
 *          summary: Add a new user
 *          description: Add a new user with the provided details.
 *          requestBody:
 *              content:
 *                  application/x-www-form-urlencoded:
 *                      schema:
 *                          type: object 
 *                          properties:
 *                              name: 
 *                                  type: string
 *                              surname: 
 *                                  type: string
 *                              login: 
 *                                  type: string
 *                              password: 
 *                                  type: string
 *          responses:
 *              '200':
 *                  description: Successful response. User added successfully.
 *              '400':
 *                  description: Bad request. User with the login already exists.
 *              '500':
 *                  description: Internal server error.
 */

app.post('/add_user', upload.none(), (req, res) => {
    try {
        const {name, surname, login, password} = req.body;
        console.log(name, surname, login, password);
        const filePath = 'photos.json';
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) || {devices: [], users: []};
        if (!data.users) {
            data.users = [];
        }
        if (data.users.some(user => user.login === login)) {
            console.error('User with the login already exists');
            return res.status(400).json({error: 'User with the login already exists'});
        }
        const newUser = {name, surname, login, password, devices: []};
        data.users.push(newUser);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        res.json({message: 'User added successfully'});
    }
    catch (error) {
        console.error('Error during user addition:', error);
        res.status(500).json({error: 'Internal server error'});
    }
});

/**
 * @openapi
 * /add_device_to_user:
 *      post:
 *          summary: Add a device to a user
 *          description: Add a device to a user with the provided details.
 *          requestBody:
 *              content:
 *                  application/x-www-form-urlencoded:
 *                      schema:
 *                          type: object 
 *                          properties:
 *                              deviceIdentifier: 
 *                                  type: string
 *                              username: 
 *                                  type: string
 *          responses:
 *              '200':
 *                  description: Successful response. Device added to the user successfully.
 *              '400':
 *                  description: Bad request. Device is already in use or not found.
 *              '404':
 *                  description: Not found. User not found or device not found.
 *              '500':
 *                  description: Internal server error.
 */

app.post('/add_device_to_user', upload.none(), (req, res) => {
    try {
        const deviceIdentifier = req.body['deviceIdentifier'];
        const username = req.body['username'];
        console.log(deviceIdentifier, username);
        console.log(req.body);
        const filePath = 'photos.json';
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) || {devices: [], users: []};
        if (!data.users) {
            data.users = [];
        }
        if (!data.devices) {
            data.devices = [];
        }
        const user = data.users.find(u => u.name === username);
        if (user) {
            const device = data.devices.find(d => d.identifier === deviceIdentifier);
            if (device) {
                if (device.usage !== 'is use') {
                    device.usage = 'is use';
                    device.user = username;
                    user.devices = user.devices || [];
                    user.devices.push({
                        identifier: device.identifier,
                        usage: 'is use'
                    });
                    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
                    res.json({message: 'Device added to the user successfully'});
                }
                else {
                    res.status(400).json({error: 'Device is already in use'});
                }
            }
            else {
                res.status(404).json({error: 'Device not found'});
            }
        }
        else {
            req.status(404).json({error: 'User not found'});
        }
    }
    catch (error) {
        console.error('Error during adding the device to the user:', error);
        res.status(500).json({error: 'Internal server error'});
    }
});

/**
 * @openapi
 * /remove_device_from_user:
 *      post:
 *          summary: Remove a device from a user
 *          description: Remove a device to a user based on the provided details.
 *          requestBody:
 *              content:
 *                  application/x-www-form-urlencoded:
 *                      schema:
 *                          type: object 
 *                          properties:
 *                              deviceIdentifier: 
 *                                  type: string
 *                              username: 
 *                                  type: string
 *          responses:
 *              '200':
 *                  description: Successful response. Device removed from the user successfully.
 *              '404':
 *                  description: Not found. User not found or device not found in the user's devices.
 *              '500':
 *                  description: Internal server error.
 */

app.post('/remove_device_from_user', upload.none(), (req, res) => {
    try {
        const deviceIdentifier = req.body['deviceIdentifier'];
        const username = req.body['username'];
        console.log(deviceIdentifier, username);
        const filePath = 'photos.json';
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) || {devices: [], users: []};
        if (!data.users) {
            data.users = [];
        }
        if (!data.devices) {
            data.devices = [];
        }
        const user = data.users.find(u => u.name === username);
        if (user) {
            const userDevices = user.devices.map(device => String(device.identifier));
            const deviceIndex = userDevices.indexOf(String(deviceIdentifier));
            if (deviceIndex !== -1) {
                const device = data.devices.find(d => d.identifier === deviceIdentifier);
                if (device) {
                    device.usage = 'no used';
                    device.user = 'available';
                }
                user.devices.splice(deviceIndex, 1);
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
                res.json({message: 'The device removed from user successfully'});
            }
            else {
                res.status(404).json({error: 'Device not found in the user\'s devices'});
            }
        }
        else {
            res.status(404).json({error: 'User not found'});
        }
    }
    catch (error) {
        console.error('Error during removing device from user:', error);
        res.status(500).json({error: 'Internal server error'});
    }
});

/**
 * @openapi
 * /user_devices:
 *      get:
 *          summary: Get devices of a user
 *          description: Retrieve the devices associated with a user based on the provided username.
 *          parameters: 
 *              - in: query
 *                name: username
 *                description: Username of the user
 *                required: true
 *                schema:
 *                  type: string
 *          responses:
 *              '200':
 *                  description: Successful response. Returns devices associated with the user.
 *              '404':
 *                  description: Not found. User not found.
 *              '500':
 *                  description: Internal server error.
 */

app.get('/user_devices', (req, res) => {
    try {
        const username = req.query.username;
        const filePath = 'photos.json';
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) || {devices: [], users: []};
        if (!data.users) {
            data.users = [];
        }
        const user = data.users.find(u => u.name === username);
        if (user) {
            const userDeviceIndentifiers = user.devices || [];
            res.json({username, devices: userDeviceIndentifiers});
        }
        else {
            res.status(404).json({error: 'User not found'});
        }
    }
    catch (error) {
        console.error('Error during fetching the user devices:', error);
        res.status(500).json({error: 'Internal server error'});
    }
});

/**
 * @openapi
 * /upload:
 *      post:
 *          summary: Upload a photo
 *          description: Upload a photo with additional information.
 *          requestBody:
 *              content:
 *                  multipart/form-data:
 *                      schema:
 *                          type: object 
 *                          properties:
 *                              identifier: 
 *                                  type: string
 *                              name: 
 *                                  type: string
 *                              description: 
 *                                  type: string
 *                              serialNumber: 
 *                                  type: string
 *                              manufacturer: 
 *                                  type: string
 *                              photo: 
 *                                  type: string
 *                                  format: binary
 *          responses:
 *              '200':
 *                  description: Successful response. The photo uploaded successfully.
 *              '500':
 *                  description: Internal server error.
 */

app.post('/upload', upload.single('photo'), (req, res) => {
    const {identifier, name, description, serialNumber, manufacturer} = req.body;
    const photoInfo = {
        identifier,
        name,
        description,
        serialNumber,
        manufacturer,
        filename: req.file.originalname
    };
    savePhotoInfo(photoInfo);
    res.json({message: 'The photo uploaded successfully'});
});

/**
 * @openapi
 * /get_all:
 *      get:
 *          summary: Get all photos
 *          description: Retrieve information about photos.
 *          responses:
 *              '200':
 *                  description: Successful response. Returns an arrays of photos.
 *              '500':
 *                  description: Internal server error.
 */

app.get('/get_all', (req, res) => {
    const photos = JSON.parse(fs.readFileSync('photos.json', 'utf-8')) || [];
    res.json(photos);
});

/**
 * @openapi
 * /edit_product:
 *      put:
 *          summary: Edit a product
 *          description: Edit a product with the provided details.
 *          requestBody:
 *              content:
 *                  application/json:
 *                      schema:
 *                          type: object 
 *                          properties:
 *                              identifier: 
 *                                  type: string
 *                              name: 
 *                                  type: string
 *                              description: 
 *                                  type: string
 *                              serialNumber: 
 *                                  type: string
 *                              manufacturer: 
 *                                  type: string
 *          responses:
 *              '200':
 *                  description: Successful response. The product edited successfully.
 *              '404':
 *                  description: Not found. The product not found.
 *              '500':
 *                  description: Internal server error.
 */

app.put('/edit_product', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync('photos.json', 'utf-8')) || { devices: [], users: [] };
        const bodyData = req.body;
        const {identifier, name, description, serialNumber, manufacturer} = bodyData;
        const devices = data.devices;
        const index = devices.findIndex(device => device.identifier === identifier);
        if (index !== -1) {
            const existingDevice = devices[index];
            existingDevice.name = name !== undefined ? name : existingDevice.name;
            existingDevice.description = description !== undefined ? description : existingDevice.description;
            existingDevice.serialNumber = serialNumber !== undefined ? serialNumber : existingDevice.serialNumber;
            existingDevice.manufacturer = manufacturer !== undefined ? manufacturer : existingDevice.manufacturer;
            
            fs.writeFileSync('photos.json', JSON.stringify(data, null, 2), 'utf-8');
            res.json({ message: 'The product edited successfully' });
        }
        else {
            res.status(404).json({error: 'Product not found'});
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({error: 'Internal server error'});
    }
});

/**
 * @openapi
 * /delete_product:
 *      delete:
 *          summary: Delete a product
 *          description: Delete a product with the provided identifier.
 *          parameters: 
 *              - in: query
 *                name: identifier
 *                description: Identifier of the product to be deleted
 *                required: true
 *                schema:
 *                  type: string
 *          responses:
 *              '200':
 *                  description: Successful response. Product deleted successfully.
 *              '404':
 *                  description: Not found. Product not found.
 *              '500':
 *                  description: Internal server error.
 */

app.delete('/delete_product', (req, res) => {
    try {
        const photosData = fs.readFileSync('photos.json', 'utf-8') || {};
        const photos = JSON.parse(photosData);
        console.log(req.query);
        const identifier = req.query.identifier;
        console.log(identifier);
        const index = photos.devices.findIndex(photo => String(photo.identifier) === String(identifier));
        if (index !== -1) {
            photos.devices.splice(index, 1);
            fs.writeFileSync('photos.json', JSON.stringify(photos, null, 2), 'utf-8');
            res.json({message: 'The product deleted successfully'});
        }
        else {
            res.status(404).json({error: 'Product not found'});
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({error: 'Internal server error'});
    }
});

app.listen(port, () => {
    console.log(`The server is running on the port ${port}`);
});