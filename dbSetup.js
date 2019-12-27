function createTable(pDB, pTable, pColumns) {
	return new Promise(resolve => {
		pStatement = "CREATE TABLE IF NOT EXISTS " + pTable + pColumns;
		console.log(pStatement);
		pDB.run(pStatement, [], (err) => {
		if (err) {
			reject ('Error while creating table: ' + err);
		} else {
			resolve(pTable + ' Table created');
		}
	  });
	});
  }

  function dropTable(pDB, pTable) {
	return new Promise(resolve => {
		pStatement = "DROP TABLE IF EXISTS " + pTable;
		console.log(pStatement);
		pDB.run(pStatement, [], (err) => {
		if (err) {
			reject ('Error while deleting table: ' + err);
		} else {
			resolve('Table ' + pTable + ' dropped');
		}
	  });
	});
  }

  function insertTable(pDB, pTable, pColumns, pOptions) {
	return new Promise(resolve => {
		pStatement = "INSERT INTO " + pTable + " " + pColumns;
		console.log(pStatement);
		pDB.run(pStatement, pOptions, (err) => {
		if (err) {
			console.log(err);
			reject ('Error while inserting data into table: ' + err);
		} else {
			var myLastID = this.lastID;
			console.log(myLastID);
			resolve(myLastID);
		}
	  });
	});
  }

function getTableRow(pDB, pQuery, pOptions) {
	return new Promise(resolve => {
		pDB.get(pQuery, pOptions, (err, row ) => {
			if (err) {
				reject('Error while querying table: ' + err);
			} else {
				resolve(row);
			}
		});
	});
}

function populateTable(pDB, pTable, pColumns, pValues) {
	return new Promise(resolve => {
		pStatement = "INSERT INTO " + pTable + " " + pColumns + " VALUES " + pValues;
		console.log(pStatement);
		pDB.run(pStatement, [], (err) => {
		if (err) {
			reject ('Error while inserting data into table: ' + err);
		} else {
			resolve('data inserted into ' + pTable + ' successfully');
		}
	  });
	});
  }

async function createDbTables(pDB) {
	/*
	console.log('Dropping tables');
	var result = dropTable(pDB, "shopping_cart");
	console.log(result);
	var result = dropTable(pDB, "customers");
	console.log(result); */

	console.log('calling createTable');
	var result = await createTable(pDB, "customers", "(customer_id integer primary key autoincrement, customer_name text, password text, first_name text, last_name text, street text, zip_code text, city text, session_id text)");
	console.log(result);
	var result = await createTable(pDB, "shopping_cart", "(session_id text, item_id int, item_name text, item_quantity int, item_price real)");
	console.log(result);
	var result = await createTable(pDB, "orders", "(order_id  integer primary key autoincrement, customer_id int, order_date text, order_remarks text)");
	console.log(result);
	var result = await createTable(pDB, "order_items", "(order_id int, order_item_id INTEGER PRIMARY KEY AUTOINCREMENT, item_id int, item_quantity INT, item_Name text, item_price real)");
	console.log(result);
	var result = await createTable(pDB, "items", "(item_id INTEGER PRIMARY KEY AUTOINCREMENT, item_name text, item_price real)");
	console.log(result);

	console.log('Populate table data...');
	var result = await populateTable(pDB, "items", "(item_name, item_price)", "('Consumer notebook', 299.99)");
	console.log(result);
	var result = await populateTable(pDB, "items", "(item_name, item_price)", "('High end notebook', 1299.99)");
	console.log(result);
	var result = await populateTable(pDB, "items", "(item_name, item_price)", "('Printer', 99)");
	console.log(result);
	var result = await populateTable(pDB, "items", "(item_name, item_price)", "('External HDD', 49.99)");
	console.log(result);
	var result = await populateTable(pDB, "items", "(item_name, item_price)", "('Monitor', 129)");
	console.log(result);
	var result = await populateTable(pDB, "customers", "(customer_name, password, first_name, last_name, street, zip_code, city)", "('guest', 'welcome', 'Jane','Doe', 'Road to nowhere', '77777', 'Nowhere')")
	console.log(result);
}

module.exports.createDbTables = createDbTables;

module.exports.insertTable = insertTable;

module.exports.getTableRow = getTableRow;