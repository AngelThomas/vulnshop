Installation
============

- Clone git repository https://github.com/AngelThomas/vulnshop to a directory of your choice
- Download and install node.js (Download from https://nodejs.org/en/download/)
- make sure location of node and npm (comes with installation of node.js) runtime are within path variable of operating system of your choice
- open terminal window in the directory which holds the cloned repository (see first step)
- run "npm install" from main directory, this installs dependencies (required node modules)
- open browser and go to http://localhost:8089
- when running in secure mode (isAppSecure = true), the url is https://localhost:8089
- to login to the shop you can use username "ant" and password "welcome"
- alternatively, you can register with a username and password of your choice
- when the app is shut down and restarted again, the data (especially shopping cart and orders) will be deleted

Introduction
============
The web app is a simple webshop app where a user can place items into a shopping cart and create an 
order from it. The user must use a customer account, either user "guest" seeded during app startup
or when registering as a new user.

The app was created using node.js including several modules, such as
- express
- ejs and bootstrap for templating
- helmet for xss protection
Further details regarding modules can be found in file package.json.

Important
---------
Per default the app runs in vulnerable mode. At the beginning of module app.js there is variable
isAppSecure, which defaults to "false". That means that the flaws described below are active. 
To activate the secure version of the app, shut down the app (press CTRL-C in the terminal window 
in which  the app is running), set isAppSecure = true and restart the app by 
npm start
in the terminal window. This time the url to access the app is https://localhost:8089 instead of
the unsecured one.

Usage
-----
Main page shows some items inserted into shop during application startup.
Items can be added to shopping cart by clicking button "add to cart" on the right hand side of the items.

To view shopping cart, click link "Shopping cart" from navigation menu. This will show the items added to
your cart. 

If you want to order the cart, click button "Place order". At this stage the app checks if a user is logged
in currently, if not, it takes the user to a login dialog where she can use an existing account (feel free
to use username "guest" with password "welcome") or register as new user instead.
After that the app forwards to the order summary, where one can add some comments to the order and submit 
the cart. 

When doing so, from the user logged on (table "customers") and the items in table "shopping_cart" an order 
will be created (order header in table "orders", order items in table "order_items") and the rows in table
shopping_cart will be removed.

Vulnerabilities
===============


Flaw 1 (A1:2017-Injection)
-----------------
The application uses a sqlite3 database to store the item data as well as the customer and order data.
There are several functions which provide logic for querying, inserting, deleting and updating data.
These functions are using SQL statements which are concatenated from the input.
This makes these parts of the app vulnerable to SQL injection attacks which might lead to exposure of
sensitive data or even access to administrative components.
Instead of concatenating the Statements together it's better to use prepared statements which are not
vulnerable to injection attacks.

Flaw 2 (A3:2017-Sensitive Data Exposure)
-------------------------------
Problem:
By default the application is running over unencrypted http connection. This is done by the code section
at the very end of the app.js file:
app.listen(portNum, () => {
	console.log('App running on port ' + portNum);
});
Thus all information will be sent unencrypted over the internet. This configuration is used when running
the app with variable isAppSecure to "false".

Solution:
By setting variable isAppSecure to "true", the secure configuration of the app is being used. Line 94
var server = https.createServer(options, app); 
creates a https server.
and at the end of app.js, isAppSecure = "true" is starting up this https server.
server.listen(portNum, () => {
	console.log('App running on port ' + portNum);
});
Thus communication with the web server is encrypted. 
Note: the application uses a self-signed certificate, which will be reported as non-trusted when first
opening the https connection. It is necessary to confirm and allow access to the application's https url.
In real life we would use a certificate of a trusted certificate authority, which usually comes with 
additional cost. As this app is some kind of proof-of-concept it should be ok to use a self signed 
certificate instead.

Flaw 3 (A4:2017-XML External Entities (XXE))
--------------------------------------------
Problem:
the app has a feature to upload a simple xml order file, which is processed by a xml parser library (libxmljs).
This parser is - depending on the configuration - prone to xxe attacks.
Solution:
Variable isAppSecure results in using the code line
xmlDoc = libxml.parseXml(xmlData);
instead of
xmlDoc = libxml.parseXml({ noent: true });
which enables xxe protection in this library.

Flaw 4 (A6:2017-Security Misconfiguration)
------------------------------------------
Problem:
Returning errors - in the vulnerable version is done by returning an error page embedded in http status 500,
meaning "internal server error". This will be recognized by e.g. Owasp ZAP as "application error disclosure".
The relevant lines within the code are:
res.status(500).send('message.html');
Solution:
Instead of sending Status 500 the application contains lines with status code 501 which is no longer detected
as an application error disclosure.
This is done by changing the value for variable 
httpErrorStatus
from 500 to 501, which is done when setting variable isAppSecure from "false" to "true"

Flaw 5 (A7:2017-Cross-Site Scripting (XSS))
-------------------------------------------
Problem:
The express framework which is used - together with bootstrap - to implement the presentation logic of the app
is vulnerable to cross site scripting attacks.
To avoid this, i integrated the helmet module which purpose is to protect node.js applications from xss attacks.
Solution:
When setting variable isAppSecure from "false" to "true", the code section from line 68 to 95 is executed. In this
block - amongst others - the line
app.use(helmet());
activates the helmet middleware which protects the application from cross site scripting attacks.
