// This file is part of Pa11y Dashboard.
//
// Pa11y Dashboard is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Pa11y Dashboard is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Pa11y Dashboard.  If not, see <http://www.gnu.org/licenses/>.
'use strict';

const presentTask = require('../view/presenter/task');
const moment = require('moment');
module.exports = route;

// Route definition
function route(app) {
	app.express.get('/', (request, response, next) => {
		app.webservice.tasks.get({lastres: true}, (error, tasks) => {
			if (error) {
				return next(error);
			}
			response.render('index', {
				tasks: tasks.map(presentTask),
				deleted: (typeof request.query.deleted !== 'undefined'),
				isHomePage: true
			});
		});
	});

	app.express.get('/download-all-latest', (request, response, next) => {

		async function tryGetTasks() {
			const taskPromise = new Promise(
				((res, rej) => {
					app.webservice.tasks.get({lastres: true}, (error, tasks) => {
						if (error) {
							rej(error);
						} else {
							res(tasks);
						}
					});
				})
			);

			const tasks = await taskPromise;
			const resultPromises = [];
			tasks.forEach(tsk => {
				resultPromises.push(
					new Promise(
						((res, rej) => {
							app.webservice.task(tsk.id).result(tsk.last_result.id).get({
								full: true
							}, (err, taskresults) => {
								if (err) {
									rej(err);
								} else {
									res(taskresults);
								}
							});
						})
					)
				);
			});

			const finalResults = [];
			const rows = ['"taskname","url","code","message","type","context","selector"'];
			for (let i=0; i < resultPromises.length; i++) {
				const results = await resultPromises[i];
				finalResults.push(results);
			}

			finalResults.forEach(result => {
				// get task
				const parentTask = tasks.filter(parentTsk => {
					return parentTsk.id === result.task;
				});
				// iterate result.results
				result.results.forEach(a11yResult => {
					rows.push([
						JSON.stringify(parentTask[0].name),
						JSON.stringify(parentTask[0].url),
						JSON.stringify(a11yResult.code),
						JSON.stringify(a11yResult.message),
						JSON.stringify(a11yResult.type),
						JSON.stringify(a11yResult.context),
						JSON.stringify(a11yResult.selector)
					].join(','));
				});
			});
			response.attachment('test.csv');
			response.send(rows.join('\n'));
		}
		tryGetTasks();
	});
}
