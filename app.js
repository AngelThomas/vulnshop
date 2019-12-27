const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const portNum = 8089;
const https = require('https');
const fs = require('fs');
const url = require('url');
const fileUpload = require('express-fileupload');
const libxml = require("libxmljs");

// variable defining if app is running in secure or insecure mode
var isAppSecure = false;
var httpErrorStatus = 500;

// security modules
const helmet = require('helmet'); // avoid xss
const csp = require('helmet-csp');
const noCache = require('nocache');
const frameguard = require('frameguard');
const noSniff = require('dont-sniff-mimetype');
const dbPath = './db/shopping.db';
const validate = require('validate.js'); // validation
var constraints = {
	validNames: {
		presence: true,
		length: { minimum: 3, maximum: 20}
	},
	validZip: {
		presence: true,
		length: { minimum: 4, maximum: 10}
	},
	validLocation: {
		presence: true,
		length: { minimum: 4, maximum: 30}
	}
}

var dbSetup = require('./dbSetup.js');
var path = require('path');
var app = express();
var cart = [];

app.use(session({secret: 'mySecret', 
				saveUninitialized: true, 
				resave: true ,
				
				cookie: {
    				httpOnly: true,
					secure: false
					// domain: 'localhost'
  				}
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static("public"));
app.use(express.static("js"));

if (isAppSecure) {
	var key = fs.readFileSync(__dirname + '/key.pem');
	var cert = fs.readFileSync(__dirname + '/cert.pem');
	var options = {
	  key: key,
	  cert: cert,
	  passphrase: 'welcome'
	};	
	app.use(helmet()); // xss protection
	app.use(noCache());
	app.use(frameguard({ action: 'sameorigin' }));
	app.use(noSniff()); // avoids mime type sniffing
	// set the content type, pragma and cache-control headers
	app.use(function(req, res, next) {
		res.set("content-type", "text/html");
		res.set('Pragma', 'no-cache');
		res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
		res.set("Content-Security-Policy", "default-src 'self'");
		next();
	});

	httpErrorStatus = 501;

	app.use(csp({
		directives: {
		  defaultSrc: ["'self'"],
		  frameAncestors: ["'self'"],
		  scriptSrc: ["'self'"],
		  sandbox: ['allow-forms', 'allow-scripts']
		  // objectSrc: ["'none'"]
		}
	  }));
	  
	var server = https.createServer(options, app);
}

app.use(bodyParser.urlencoded({extended:true}));

app.use(fileUpload({
	limits: { fileSize: 50 * 1024 * 1024 },
  }));

try {
	fs.unlinkSync(dbPath);
	console.log('DB file deleted');
} catch (err) {
	console.log(err);
}

let db = new sqlite3.Database('./db/shopping.db');
// let db = new sqlite3.Database(':memory:');

function queryTable(pTable, pSessionId) {
	return new Promise((resolve, reject) => {
		pStatement = "SELECT * FROM " + pTable + " WHERE session_id = ?";
		console.log(pStatement);
		db.all(pStatement, [pSessionId], (err, rows) => {
		if (err) {
			reject ('Error while inserting data into table: ' + err);
		} else {
			resolve(rows);
		}
	  });
	});
  }

  function queryTableRow(pTable, pSessionId) {
	return new Promise((resolve, reject) => {
		pStatement = "SELECT * FROM " + pTable + " WHERE session_id = ?";
		console.log(pStatement);
		db.get(pStatement, [pSessionId], (err, row) => {
		if (err) {
			reject ('Error while inserting data into table: ' + err);
		} else {
			resolve(row);
		}
	  });
	});
  }

  function queryTableByColumns(pTable, pColumns, pOptions) {
	return new Promise((resolve, reject) => {
		pStatement = "SELECT * FROM " + pTable + " WHERE " + pColumns;
		console.log(pStatement);
		db.get(pStatement, pOptions, (err, row) => {
		if (err) {
			reject ('Error while querying data from table: ' + err);
		} else {
			resolve(row);
		}
	  });
	});
  }

  function clearTable(pTable, pSessionId) {
	return new Promise((resolve, reject) => {
		pStatement = "DELETE FROM " + pTable + " WHERE session_id = ?";
		console.log(pStatement);
		db.run(pStatement, [pSessionId], (err) => {
		if (err) {
			console.log("Error while clearing shopping_cart: " + err);
			reject ('Error while inserting data into table: ' + err);
		} else {
			resolve('rows removed from table ' + pTable);
		}
	  });
	});
  }

  function removeFromTable(pTable, pColumn, pId, pSessionId) {
	return new Promise((resolve, reject) => {
		pStatement = "DELETE FROM " + pTable + " WHERE " + pColumn + " = ? AND session_id = ?";
		console.log(pStatement);
		db.run(pStatement, [pId, pSessionId], (err) => {
		if (err) {
			console.log("Error while clearing shopping_cart: " + err);
			reject ('Error while inserting data into table: ' + err);
		} else {
			resolve('rows removed from table ' + pTable);
		}
	  });
	});
  }

  function insertTable(pDB, pTable, pColumns, pOptions) {
	return new Promise((resolve, reject) => {
		pStatement = "INSERT INTO " + pTable + " " + pColumns;
		console.log(pStatement);
		pDB.run(pStatement, pOptions, function (err) {
			if (err) {
				console.log(err);
				reject ('Error while inserting data into table: ' + err);
			} else {
				var myLastID = this.lastID;
				console.log("Last ID: " + myLastID);
				resolve(myLastID);
			}
	  	});
	});
  }

function updateTableById(pTable, pColumns, pOptions, pId) {
	return new Promise((resolve, reject) => {
		pStatement = "UPDATE " + pTable + " SET " + pColumns + " WHERE customer_id = " + pId;
		console.log("updateTableById SQL: " + pStatement);
		db.run(pStatement, pOptions, function (err) {
			if (err) {
				console.log(err);
				reject ('Error while inserting data into table: ' + err);
			} else {
				resolve('Success');
			}
	  	});
	});
}

dbSetup.createDbTables(db);

app.get('/', (req, res) => {
	console.log("Current Session ID: " + req.sessionID);
	var sqlStmt = "SELECT * FROM items WHERE lower(item_name) like lower(?)";
	var searchItemString;
	if (req.query.searchItem && req.query.searchItem.length > 0) {
		console.log('Search item: ' + req.query.searchItem);
		searchItemString = '%' + req.query.searchItem + '%';
	} else {
		searchItemString = "%";
	}
	pOptions = [ searchItemString ];
	
	if (!isAppSecure)  {
		var sqlStmt = "SELECT * FROM items WHERE lower(item_name) like lower('";
		sqlStmt += searchItemString + "')";
		pOptions = [];
	}
	console.log("SQL : " + sqlStmt);
	var itemList = [];
	db.all(sqlStmt, pOptions, function(err, itemRows) {
		if (err) {
			console.log('Error while executing statement ' + sqlStmt);
			console.log('Error: ' + err);
			res.send('message.html');
		} else {
			itemRows.forEach(function(item) {
				itemRow = {"itemNr": item.item_id, "itemName": item.item_name, "itemPrice": item.item_price};
				itemList.push(itemRow);
			});
			console.log("loggedIn: " + req.session.loggedin);
			res.render('main', { items:itemList, isLoggedIn:req.session.loggedin});
		}
	});
});

app.get('/showCart', (req, res) => {
	var mySessionId = req.sessionID;
	var cartSQL = "SELECT * FROM shopping_cart WHERE session_id = ?";
	var myCart = [];
	var cartRow;
	db.all(cartSQL, [mySessionId], function(err, rows) {
		if (err) {
			console.log(err);
			res.redirect('/');
		} else {
			rows.forEach(function(item) {
				cartRow = {"itemId": item.item_id, "itemName": item.item_name, "itemPrice": item.item_price, "itemQuantity":item.item_quantity};
				myCart.push(cartRow);
			});
			res.render('showCart', { itemCount: myCart.length, cartItems: myCart, isLoggedIn:req.session.loggedin });
		}
	})
});

app.post('/removeFromCart', async (req, res) => {
	var removeItemId = req.body.prodNr;
	console.log("removeItemId: " + removeItemId);
	removeFromTable("shopping_cart", "item_id", removeItemId, req.sessionID);
	var myCart = await queryTable("shopping_cart", req.sessionID);
	var tmpCart = [];
	myCart.forEach(function(item) {
		cartRow = {"itemId": item.item_id, "itemName": item.item_name, "itemPrice": item.item_price, "itemQuantity":item.item_quantity};
		tmpCart.push(cartRow);	
	});

	cart = tmpCart; 
	res.render('showCart', { itemCount: cart.length, cartItems: cart, isLoggedIn:req.session.loggedin });
});

app.post('/add2cart', async (req, res) => {
	console.log('In add2cart');
	var bodyDoc = req.body;
	var bodyJsonText = JSON.stringify(bodyDoc);
	var bodyJson = JSON.parse(bodyJsonText);
	var cartItemId;
	Object.keys(bodyJson).forEach(function(key) {
		if (key.indexOf("add2cart") >= 0) {
			cartItemId = key.substring(key.indexOf("_")+1, key.length);
			console.log("Cart Item Id from submit: " + cartItemId);
		}
	});
	var pOptions = [cartItemId];
	
	try {
		var itemData = await queryTableByColumns("items", "item_id = ?", pOptions);
	} catch (err) {
		console.log("Error while querying items: " + err)
		var errorText = "An internal error occurred";
		// res.status(501).send('message.html');
		res.status(httpErrorStatus).send('message.html');
	}

	if (itemData != undefined) {
		if (!isNaN(req.body.quantity) && itemData.item_price && itemData.item_id != undefined) {
			var mySessionId = req.sessionID;
			var cartItemQty = req.body.quantity;
			var cartItemName = itemData.item_name;
			var cartItemPrice = itemData.item_price;

			var insertStmt = "INSERT INTO shopping_cart(session_id, item_id, item_name, item_quantity, item_price) VALUES (?, ?, ?, ?, ?)";
			db.run(insertStmt, [mySessionId, cartItemId, cartItemName, cartItemQty, cartItemPrice], function(err) {
				if (err) {
					console.log(err);
				}
				res.redirect('/');
			});
		} else {
			var errorText = "Invalid item Data, cannot insert into cart";
			// res.status(501).send('message.html');
			res.status(httpErrorStatus).send('message.html');
		}
	} else {
		var errorText = "Invalid item Data, cannot insert into cart";
		// res.status(501).send('message.html');	
		res.status(httpErrorStatus).send('message.html');	
	}
});

app.get('/error', function(req, res) {
	var errorText = req.query.errorMessage;
	res.render('error', {errorMessage: errorText});
});

app.post('/placeOrder', async (req, res) => {
	console.log('in place order');
	var cFName = req.body.firstName;
	var cLName = req.body.lastName;
	var cStreet = req.body.adrStreet;
	var cZip = req.body.adrZip;
	var cCity = req.body.adrCity;
	var oRemarks = req.body.orderRemarks;
	var insOptions = [cFName, cLName, cStreet, cZip, cCity]
	var pOptions = [req.sessionID, cFName, cLName];
	var customerData = await queryTableByColumns("customers", "session_id = ? AND first_name = ? AND last_name = ?", pOptions);
	if (customerData) {
		var customerId = customerData.customer_id;
		console.log("Last ID (Customer): " + customerId);
		if (isNaN(customerId)) {
			res.redirect(url.format({
				pathname:"/error",
				query: {
				"errorMessage": customerId
				}
			}));
		}

		var orderDate = new Date().toISOString();
		insOptions = [customerId, orderDate, oRemarks];
		var orderId = await insertTable(db, "orders", "(customer_id, order_date, order_remarks) VALUES (?, ?, ?)", insOptions);
		console.log("Last ID (order): " + orderId);
		if (isNaN(orderId)) {
			res.redirect(url.format({
				pathname:"/error",
				query: {
				"errorMessage": orderId
				}
			}));
		}

		var myCart = await queryTable("shopping_cart", req.sessionID);
		var cartArr = [];
		myCart.forEach(function(item) {
			cartArr.push(orderId);
			cartArr.push(item.item_id);
			cartArr.push(item.item_quantity);
			cartArr.push(item.item_name);
			cartArr.push(item.item_price);
		});
		var placeHolders = myCart.map(() => "(?,?,?,?,?)").join(',');
		console.log(cartArr);
		insStr = "INSERT INTO order_items(order_id, item_id, item_quantity, item_name, item_price) values " + placeHolders;
		console.log(insStr);
		db.run(insStr, cartArr, function(err) {
			if(err) {
				console.log("Error while inserting order lines: " + err);
			}
		});
		var clearResult = await clearTable("shopping_cart", req.sessionID);
		res.redirect('/');
	} else {
		// res.status(501).send('message.html');
		res.status(httpErrorStatus).send('message.html');
	} 
});

app.get('/orderCart', async (req, res) => {
	console.log("req in orderCart, loggedin: " + req.session.loggedin + ", username: " + req.session.username);
	if (req.session.loggedin) {
		// console.log(req.session);
		var orderCart = await queryTable("shopping_cart", req.sessionID);
		console.log('# of items in orderCart: ' + orderCart.length);
		console.log(orderCart);
		var myCart = [];
		userRow = { userName: req.session.userName, firstName: req.session.firstName, lastName: req.session.lastName, street: req.session.street, zipCode: req.session.zipCode, city: req.session.city }
		console.log('userrow: ' + userRow.userName + ", " + userRow.lastName);
		orderCart.forEach(function(item) {
			var cartItem = { "itemId": item.item_id, "itemQuantity": item.item_quanitity, "itemName": item.item_name, "itemPrice": item.item_price}
			myCart.push(cartItem);
		});
		
		// res.render('orderCart', {cartItems: cart});
		res.render('orderCart', {cartItems: myCart, userData: userRow, isLoggedIn:req.session.loggedin});
	} else {
		res.render('login');
	}
});

app.post("/createNewCustomer", async function(req, res) {
	var newAccountName = req.body.accountName;
	var newFirstName = req.body.firstName;
	var newLastName = req.body.lastName;
	var newStreet = req.body.adrStreet;
	var newZipCode = req.body.adrZip;
	var newCity = req.body.adrCity;
	var newPassword = req.body.adrPassword;
	var currentSession = req.sessionID;
	if (validate({validNames: newFirstName}, constraints) != undefined &&
		validate({validNames: newLastName}, constraints) != undefined &&
		validate({validZip: newZipCode}, constraints) != undefined &&
		validate({validLocation: newStreet}, constraints) != undefined &&
		validate({validLocation: newCity}, constraints) != undefined) {
		pOptions = [newAccountName, newFirstName, newLastName, newStreet, newZipCode, newCity, newPassword, currentSession];
		var result = await insertTable(db, "customers", "(customer_name, first_name, last_name, street, zip_code, city, password, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", pOptions);
		if (!isNaN(result)) {
			req.session.loggedin = true;
			req.session.username = newAccountName;
			req.session.firstName = newFirstName;
			req.session.lastName = newLastName;
			req.session.street = newStreet;
			req.session.zipCode = newZipCode;
			req.session.city = newCity;		
			res.redirect('/');
		} else {
			res.render('error', {errorMessage: result});
		}
	} else {
		var errText = "Error during address validation";
		res.render('error', {errorMessage: errText});
	}
});

app.post('/auth', async function(req, res){
	res.set("Content-Security-Policy", "default-src 'self'");
	var inputIsValid = true;
	try {
		var userName = req.body.username;
		var passwd = req.body.password;
		if (userName.indexOf('%') >= 0 || userName.indexOf('/') >= 0 || passwd.indexOf('/') >= 0 || passwd.indexOf('%') >= 0) {
			inputIsValid = false;
		}
		var loggedIn;

		var row = await queryTableByColumns("customers", "customer_name = ? AND password = ?", [userName, passwd]);
		if (row != undefined && inputIsValid) {
			console.log(row);
			console.log('Found ID ' + row.customer_id);
			loggedIn = true;
			req.session.loggedin = true;
			req.session.username = row.customer_name;
			req.session.firstName = row.first_name;
			req.session.lastName = row.last_name;
			req.session.street = row.street;
			req.session.zipCode = row.zip_code;
			req.session.city = row.city;
			pOptions = [req.sessionID];
			var result = await updateTableById("customers", "session_id = ?", pOptions, row.customer_id);
			console.log("Result from update customers: " + result);
			console.log("req before redirect, loggedin: " + req.session.loggedin + ", username: " + req.session.username);
			var orderCart = await queryTable("shopping_cart", req.sessionID);
			var myCart = [];
			userRow = { userName: req.session.userName, firstName: req.session.firstName, lastName: req.session.lastName, street: req.session.street, zipCode: req.session.zipCode, city: req.session.city }
			if (orderCart.length > 0) {
				orderCart.forEach(function(item) {
					var cartItem = { "itemId": item.item_id, "itemQuantity": item.item_quanitity, "itemName": item.item_name, "itemPrice": item.item_price}
					myCart.push(cartItem);
				});
				res.render('orderCart', {cartItems: myCart, userData: userRow});
			} else {
				res.redirect('/');
			}
		} else {
			loggedIn = false;
			// res.status(501).send('message.html');
			res.status(httpErrorStatus).send('message.html');
		}
	} catch (err) {
		loggedIn = false;
		// res.status(501).send('message.html');
		res.status(httpErrorStatus).send('message.html');	
	}
});

app.post('/processFileUpload', async function(req, res) {
	var xmlDoc;
	try {
		if (req.files.uploadFileName.data) {
		
			var xmlData = req.files.uploadFileName.data.toString();
			// avoid xxe attack
			if (isAppSecure) {
				xmlDoc = libxml.parseXml(xmlData);
			} else {
				xmlDoc = libxml.parseXml(xmlData, { noent: true });
			}
			
			var customerNode = xmlDoc.get('//customer');
			var xmlCustomerId = customerNode.get('//customer_id').text();
			var lineNode = xmlDoc.get('//line');
			var xmlItemId = lineNode.get('//item_id').text();
			var xmlItemQuantity = lineNode.get('//item_quantity').text();	
			console.log('Customer Id: ' + xmlCustomerId);
			console.log('Order item Id: ' + xmlItemId + ", quantity: " + xmlItemQuantity);
			var pOptions = [xmlCustomerId];
			var pColumns = "customer_id = ?"
			var customerResult = await queryTableByColumns("customers", pColumns, pOptions);
			console.log(customerResult);
			pOptions = [xmlItemId];
			pColumns = "item_id = ?"
			var itemResult = await queryTableByColumns("items", pColumns, pOptions);
			console.log(itemResult);
			if (customerResult && !isNaN(customerResult.customer_id) && itemResult && !isNaN(itemResult.item_id)) {
				var orderDate = new Date().toISOString();
				var insOptions = [customerResult.customer_id, orderDate];
				pColumns = "(customer_id, order_date) VALUES (?, ?)";
				var orderId = await insertTable(db, "orders", pColumns, insOptions);
				console.log("order id in processFileUpload: " + orderId);

				pColumns = "(order_id, item_id, item_quantity, item_name, item_price) VALUES (?, ?, ?, ?, ?)";
				insOptions = [orderId, itemResult.item_id, xmlItemQuantity, itemResult.item_name, itemResult.item_price];
				var itemId = await insertTable(db, "order_items", pColumns, insOptions);
				console.log("item id in processFileUpload: " + itemId);
				res.end('File received');
			} else {
				res.status(httpErrorStatus).send("error.html");
			}

	  	}
	} catch (err) {
		console.log(err);
		res.status(httpErrorStatus).send("message.html");
	}
});

app.get('/uploadFile', function(req, res) {
	res.render('uploadFile');
})

app.get('/register', function(req, res) {
	res.render('createCustomer', {isLoggedIn:req.session.loggedin});
});

app.get('/logout', function(req, res) {
	req.session.loggedin = false;
	req.session.username = null;
	req.session.firstName = null;
	req.session.lastName = null;
	req.session.street = null;
	req.session.zipCode = null;
	req.session.city = null;
	db.run("UPDATE customers SET session_id = NULL WHERE session_id = ?", [req.sessionID], function(err) {
		if (err) {
			var errorText = "Error " + err + " during logout";
			res.render('error', {errorMessage: errorText});
		} else {
			res.redirect('/');
		}
	});
});

app.get('/login', async function(req, res) {
	if (req.session.loggedin === true) {
		var customerRow = await queryTableRow("customers", req.sessionID).catch(function(err) {
			// res.status(501).send("message.html");
			res.status(httpErrorStatus).send('message.html');
		});
		if (customerRow) {
			var customerData = { cUser: customerRow.customer_name, cFirst: customerRow.first_name, cLast: customerRow.last_name, cStreet: customerRow.street, cZip: customerRow.zip_code, cCity: customerRow.city};
			var orderSQL = "SELECT o.order_id, order_date, order_remarks, item_id, item_Name, item_quantity, item_price FROM orders o JOIN order_items oi on oi.order_id = o.order_id WHERE customer_id = ? ORDER BY o.order_id, oi.order_item_id";
			var vOptions = [customerRow.customer_id];
			db.all(orderSQL, vOptions, function(err, rows) {
				if (err) {
					res.render('error', {errorMessage: "Error while querying order data"});
				} else {
					var orderData = [];
					rows.forEach(function(row) {
						var orderRow = {"orderId": row.order_id,
										"orderDate": row.order_date,
										"orderRemarks": row.order_remarks,
										"orderItemId": row.item_id,
										"orderItemName": row.item_name,
										"orderItemQuantity": row.item_quantity,
										"orderItemPrice": row.item_price
									}
						orderData.push(orderRow);
					});
					res.render('editCustomer', {data: customerData, orderItems: orderData});
				}
			});
		} else {
			// res.status(501).send("message.html");
			res.status(httpErrorStatus).send('message.html');
		}
	} else {
		res.render('login', {isLoggedIn:req.session.loggedin});
	}
});


if (isAppSecure) {
	server.listen(portNum, () => {
		console.log('App running on port ' + portNum);
	}); 
} else {
	app.listen(portNum, () => {
		console.log('App running on port ' + portNum);
	});
}