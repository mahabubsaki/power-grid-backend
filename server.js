const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb')
require('dotenv').config()
const jwt = require('jsonwebtoken');
const app = express()
const port = process.env.PORT || 5000
app.use(cors())
app.use(express.json())
app.get('/', (req, res) => {
    res.send('Hello World!')
})
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
const uri = `mongodb+srv://${process.env.DB_OWNER}:${process.env.DB_PASSWORD}@cluster0.wcxgg.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
const run = async () => {
    try {
        await client.connect();
        const billCollection = client.db('Power-Grid').collection('bills')
        const userCollection = client.db('Power-Grid').collection('users')

        // this api is for signup and token issue
        app.post('/api/registration', async (req, res) => {
            const findEmail = await userCollection.findOne({ email: req.body.email })
            if (!findEmail) {
                const result = await userCollection.insertOne(req.body)
                if (result.acknowledged) {
                    const token = jwt.sign({ email: req.body.email }, process.env.SECRET_KEY, {
                        expiresIn: "24h"
                    })
                    return res.send({ acknowledged: true, token: token })
                }
                else {
                    return res.status(404).send({ message: 'Something went wrong' })
                }
            }
            else {
                return res.status(404).send({ message: 'Account already exists' })
            }
        })

        // this api is for login check and issue token
        app.get('/api/login', async (req, res) => {
            const findEmail = await userCollection.findOne({ email: req.query.email })
            if (!findEmail) {
                return res.status(404).send({ message: 'Email not found' })
            }
            if (findEmail.password !== req.query.password) {
                return res.status(404).send({ message: 'Incorrect Password' })
            }
            const token = jwt.sign({ email: req.query.email }, process.env.SECRET_KEY, {
                expiresIn: "24h"
            })
            return res.send({ acknowledged: true, token: token })
        })
        // this api is for add a billing into database
        app.post('/api/add-billing', tokenVerification, async (req, res) => {
            return res.send(await billCollection.insertOne(req.body))
        })
        // this api will give us all the billing information
        app.get('/api/billing-list', tokenVerification, async (req, res) => {
            return res.send(await billCollection.find({}).toArray())
        })

        // this api for updating a bill
        app.put('/api/update-billing/:billId', tokenVerification, async (req, res) => {
            const filter = { id: req.params.billId }
            const updateDoc = {
                $set: req.body
            };
            return res.send(await billCollection.updateOne(filter, updateDoc))
        })
        // this api for deleting a bill
        app.delete('/api/delete-billing/:billId', tokenVerification, async (req, res) => {
            const query = { id: req.params.billId }
            return res.send(await billCollection.deleteOne(query))
        })

        // this api will calculate the sum of all bill
        app.get('/api/all-bills-info', tokenVerification, async (req, res) => {
            const billCount = await billCollection.estimatedDocumentCount()
            const paidArray = await billCollection.find({}).toArray()
            const paidCount = sumOfBill(paidArray)
            res.send({ billCount, paidCount })
        })

        // this api created for pagination and search query combined
        app.get('/api/bills-max-ten', tokenVerification, async (req, res) => {
            const currentPage = Number(req.query.currentpage) - 1
            if (req.query.fullname || req.query.phone || req.query.email) {
                if (req.query.fullname) {
                    return res.send(await billCollection.find({ fullname: req.query.fullname }).skip(currentPage * 10).limit(10).toArray())
                }
                else if (req.query.email) {
                    return res.send(await billCollection.find({ email: req.query.email }).skip(currentPage * 10).limit(10).toArray())
                }
                else {
                    return res.send(await billCollection.find({ phone: req.query.phone }).skip(currentPage * 10).limit(10).toArray())
                }
            }
            else {
                return res.send(await billCollection.find({}).skip(currentPage * 10).limit(10).toArray())
            }
        })
    }
    finally { }
}
run().catch(console.dir)


// middleware for token tokenVerification
const tokenVerification = async (req, res, next) => {
    if (!req.headers.authorization) {
        return res.status(401).send({ message: 'Unauthorized Acess' })
    }
    jwt.verify(req.headers.authorization.split(' ')[1], process.env.SECRET_KEY, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "Forbidden Acess" })
        }
        if (decoded.email !== req.headers.email) {
            return res.status(403).send({ message: "Forbidden Acess" })
        }
        next()
    });
}

// a common function to get sum from an array of objects
const sumOfBill = (arr) => {
    const amounts = arr.map(bill => bill.amount)
    const cost = amounts.reduce((acc, cur) => acc + cur, 0)
    return cost
}