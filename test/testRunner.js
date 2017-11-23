import glob from "glob"
import path from "path"

describe("Unit Tests", function() {
    glob.sync(path.join(__dirname, "../lib/**/*.spec.js")).forEach(file => {
        require(file) // eslint-disable-line
    })
})

describe("Integration Tests", function() {
    glob.sync(path.join(__dirname, "./integration/**/*.js")).forEach(file => {
        require(file) // eslint-disable-line
    })
})
