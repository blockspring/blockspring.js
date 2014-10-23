# blockspring.js

Javascript library to assist in creating blocks on Blockspring.

### Installation

```bash
npm install blockspring
```

### Example Usage

```javascript
var blockspring = require('blockspring');

blockspring.define(function(request, response) {
    var sum = request.params.num1 + request.params.num2;
    response.addOutput('sum', sum);
    response.end();
});
```

### License

MIT

### Contact

Email us: founders@blockspring.com
