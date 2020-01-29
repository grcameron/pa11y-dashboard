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

module.exports = route;

function taskState(counts) {
	if (counts.error > 0) {
		return 'error';
	}

	if (counts.warning > 0) {
		return 'warning';
	}

	if (counts.notice > 0) {
		return 'notice';
	}

	return 'none';
}

function getGroupName(taskName) {
	const parts = taskName.split(':');
	if (parts.length >= 2) {
		return parts[0];
	}
	return 'noAreaDefined';
}

function groupBy(objectArray, property) {
	return objectArray.reduce((acc, obj) => {
		const key = obj[property];
		if (!acc[key]) {
			acc[key] = [];
		}
		acc[key].push(obj);
		return acc;
	}, {});
}

// Route definition
function route(app) {
	app.express.get('/wallboard', (request, response, next) => {
		if (request.query.reload !== undefined) {
			return response.render('reload', {
				layout: false,
				url: 'wallboard'
			});
		}

		app.webservice.tasks.get({lastres: true}, (error, tasks) => {
			if (error) {
				return next(error);
			}

			const grouped = tasks.reduce((groups, task) => {
				if (!task.last_result) {
					return groups;
				}

				task.overallState = taskState(task.last_result.count);

				const parts = task.name.split(':');
				if (parts.length >= 2) {
					const group = parts[0];
					task.name = parts.slice(1).join(':');

					if (!groups[group]) {
						groups[group] = [];
					}

					groups[group].push(task);
				} else {
					groups.default.push(task);
				}

				return groups;
			}, {default: []});

			const groups = Object.entries(grouped).map(([groupName, groupedTasks], index) => ({
				groupName,
				index,
				defaultGroup: groupName === 'default',
				tasks: groupedTasks
			})).filter(group => group.tasks.length > 0);

			response.render('wallboard', {
				groups,
				layout: false
			});
		});
	});

	app.express.get('/wallboard-graph', (request, response, next) => {
		if (request.query.reload !== undefined) {
			return response.render('reload', {
				layout: false,
				url: 'wallboard-graph'
			});
		}

		app.webservice.tasks.get({}, (error, tasks) => {
			app.webservice.tasks.results({}, (error, results) => {
				if (error) {
					return next(error);
				}

				const tasksLookup = tasks.reduce((acc, curr) => {
					acc[curr.id] = curr;
					return acc;
				}, {});

				const modifiedResults = results.map(result => ({
					date: result.date.split('T')[0],
					errors: result.count.error,
					warnings: result.count.warning,
					notices: result.count.notice,
					name: tasksLookup[result.task].name,
					group: getGroupName(tasksLookup[result.task].name)
				}));

				let finalResults = [];
				for (const result of modifiedResults) {
					if(finalResults.filter(finalResult => (finalResult.name === result.group && finalResult.date === result.date)).length > 0)
					{
						finalResults.find(x => x.name === result.group && x.date === result.date).errors += result.errors;
						finalResults.find(x => x.name === result.group && x.date === result.date).warnings += result.warnings;
						finalResults.find(x => x.name === result.group && x.date === result.date).notices += result.notices;
					}
					else
					{
						// create new object
						finalResults.push({
							date: result.date.split('T')[0],
							errors: result.errors,
							warnings: result.warnings,
							notices: result.notices,
							name: result.group
						});
					}
				}

				// Break down this further into groups name: x
				// take the latest date, return total counts
				response.render('wallboard-graph', {
					data: JSON.stringify(finalResults),
					layout: false
				});
			});
		});
	});
}
