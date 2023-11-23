import headsets from './Headsets.js';
import fetch from 'node-fetch';
import chalk from 'chalk';

export default class OculusRequest {
  static baseUrl = 'https://graph.oculus.com';
  static path = '/graphql';
  static locale = 'en_US';

  static async post(queryParams, reason) {
    // console.log(chalk.yellow(`Getting data from Oculus Store... (${reason})`));
    // console.time("OculusRequest");
    const params = new URLSearchParams(queryParams).toString();
    const url = `${OculusRequest.baseUrl}${OculusRequest.path}?${params}&forced_locale=${OculusRequest.locale}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.text();
      // console.timeEnd("OculusRequest");
      return JSON.parse(data);
    } catch (error) {
      console.error(error);
    }
  }

  static getQueryParams(params) {
    const getVariables = {
      applications: OculusRequest.getVariablesForApplications,
      applicationsDetails: OculusRequest.getVariablesForApplicationsDetails,
    }

    return {
      access_token: process.env.OCULUS_ACCESS_TOKEN,
      doc_id: params.doc_id || null,
      forced_locale: params.forced_locale || OculusRequest.locale,
      variables: JSON.stringify(
        getVariables[params.requestType](params)
      ),
    };
  }

  static getVariablesForApplications(params) {
    return {
      sectionId: params.sectionId || headsets[0].id,
      sortOrder: params.sortOrder || "alpha",
      sectionItemCount: params.sectionItemCount || 1,
      sectionCursor: params.sectionCursor || null,
      hmdType: params.hmdType || headsets[0].code,
    };
  }

  static getVariablesForApplicationsDetails(params) {
    return {
      itemId: params.itemId || null,
      first: params.first || 1,
      last: params.last || null,
      after: params.after || null,
      before: params.before || null,
      forward: params.forward || true,
      ordering: params.ordering || null,
      ratingScores: params.rationgScores || null,
      hmdType: params.hmdType || headsets[0].code,
    }
  }
}
