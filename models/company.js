"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");

/** Related functions for companies. */

class Company {
  /** Create a company (from data), update db, return new company data.
   *
   * data should be { handle, name, description, numEmployees, logoUrl }
   *
   * Returns { handle, name, description, numEmployees, logoUrl }
   *
   * Throws BadRequestError if company already in database.
   * */

  static async create({ handle, name, description, numEmployees, logoUrl }) {
    const duplicateCheck = await db.query(`
        SELECT handle
        FROM companies
        WHERE handle = $1`, [handle]);

    if (duplicateCheck.rows[0])
      throw new BadRequestError(`Duplicate company: ${handle}`);

    const result = await db.query(`
                INSERT INTO companies (handle,
                                       name,
                                       description,
                                       num_employees,
                                       logo_url)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING
                    handle,
                    name,
                    description,
                    num_employees AS "numEmployees",
                    logo_url AS "logoUrl"`, [
          handle,
          name,
          description,
          numEmployees,
          logoUrl,
        ],
    );
    const company = result.rows[0];

    return company;
  }

  /** Find all companies.
   *
   * Returns [{ handle, name, description, numEmployees, logoUrl }, ...]
   * */

  static async findAll(query = {}) {

  // TODO: consider having helper fn just create the WHERE clause
  // Consider having default query string here (consider refactoring after sprint)

    const { nameLike, minEmployees, maxEmployees } = query;

    const { q, queryParams } = this._createSearchQueryAndParams({nameLike, minEmployees, maxEmployees});

    const companiesRes = await db.query(q, queryParams);

    return companiesRes.rows;
  }

  /** getQueryFilters
   *
   *  Gets query filters from passed in parameters if given.
   *
   *  Returns query string and added parameters if given.
   */

  static _createSearchQueryAndParams({nameLike, minEmployees, maxEmployees}) {


    const whereClauseParts = [];
    const queryParams = [];
    let filtersCount = 0;

    let q = `
    SELECT handle,
            name,
           description,
          num_employees AS "numEmployees",
          logo_url AS "logoUrl"
    FROM companies`;

    if (nameLike) {
      filtersCount++;
      queryParams.push(`%${nameLike}%`);
      whereClauseParts.push(`name ILIKE $${filtersCount}`);
    }

    if (minEmployees !== undefined) {
      filtersCount++;
      queryParams.push(minEmployees);
      whereClauseParts.push(`num_employees >= $${filtersCount}`);
    }

    if (maxEmployees !== undefined) {
      filtersCount++;
      queryParams.push(maxEmployees);
      whereClauseParts.push(`num_employees <= $${filtersCount}`);
    }

    if (whereClauseParts.length !== 0) {
        q += " WHERE " + whereClauseParts.join(" AND ");
      }

      q += " ORDER BY name;";

    return {q, queryParams}

  }

  /** Given a company handle, return data about company.
   *
   * Returns { handle, name, description, numEmployees, logoUrl, jobs }
   *   where jobs is [{ id, title, salary, equity, companyHandle }, ...]
   *
   * Throws NotFoundError if not found.
   **/

  static async get(handle) {
    const companyRes = await db.query(`
        SELECT handle,
               name,
               description,
               num_employees AS "numEmployees",
               logo_url      AS "logoUrl"
        FROM companies
        WHERE handle = $1`, [handle]);

    const company = companyRes.rows[0];

    if (!company) throw new NotFoundError(`No company: ${handle}`);

    return company;
  }

  /** Update company data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain all the
   * fields; this only changes provided ones.
   *
   * Data can include: {name, description, numEmployees, logoUrl}
   *
   * Returns {handle, name, description, numEmployees, logoUrl}
   *
   * Throws NotFoundError if not found.
   */

  static async update(handle, data) {
    const { setCols, values } = sqlForPartialUpdate(
        data,
        {
          numEmployees: "num_employees",
          logoUrl: "logo_url",
        });
    const handleVarIdx = "$" + (values.length + 1);

    const querySql = `
        UPDATE companies
        SET ${setCols}
        WHERE handle = ${handleVarIdx}
        RETURNING
            handle,
            name,
            description,
            num_employees AS "numEmployees",
            logo_url AS "logoUrl"`;
    const result = await db.query(querySql, [...values, handle]);
    const company = result.rows[0];

    if (!company) throw new NotFoundError(`No company: ${handle}`);

    return company;
  }

  /** Delete given company from database; returns undefined.
   *
   * Throws NotFoundError if company not found.
   **/

  static async remove(handle) {
    const result = await db.query(`
        DELETE
        FROM companies
        WHERE handle = $1
        RETURNING handle`, [handle]);
    const company = result.rows[0];

    if (!company) throw new NotFoundError(`No company: ${handle}`);
  }
}


module.exports = Company;
