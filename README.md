# blockspring.js

Javascript library to assist in creating blocks on Blockspring.

### Installation

```bash
npm install blockspring
```

### Example Usage

Save the following script to an example.js file:
```javascript
var blockspring = require('blockspring');

blockspring.define(function(request, response) {
    var sum = request.params.num1 + request.params.num2;
    response.addOutput('sum', sum);
    response.end();
});
```

Then in your command line write:
```shell
node example.js --num1=20 --num2=50
```

or

```shell
echo '{"num1":20, "num2": 50}' | node example.js
```

### License

MIT

### Contact

Email us: founders@blockspring.com
