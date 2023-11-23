import SupabaseRequest from "./SupabaseRequests.js";
import OculusRequest from "./OculusRequests.js";
import headsets from './Headsets.js';
import HeadsetUtils from "./HeadsetUtils.js";
import fetch from 'node-fetch';
import boxen from 'boxen';
import chalk from 'chalk';

export default class MetaScraper {

  // ###########################################
  // Database infos
  // ###########################################

  static async getDatabaseInfos() {
    return {
      applicationsMetaIds: (await SupabaseRequest.getAll('Applications', 'meta_id')).map(app => app.meta_id),
      numberOfApplications: await SupabaseRequest.getCount('Applications'),
      numberOfApplicationsDetails: await SupabaseRequest.getCount('ApplicationDetails'),
      numberOfApplicationsImages: (await SupabaseRequest.listFiles('ApplicationsImages')).length
    }
  }

  // ###########################################
  // Oculus store infos
  // ###########################################

  static async getOculusStoreInfos() {
    const numberOfApplications = [];

    for (const headset of headsets) {
      const totalApplications = await MetaScraper.getApplicationsCountForHeadset(headset);
      numberOfApplications.push({
        headset: headset.name,
        total: totalApplications
      });
    }
    return numberOfApplications;
  }

  static async getApplicationsCountForHeadset(headset, forceUpdate = false) {
    const lastUpdate = await MetaScraper.getInfosForHeadset(headset.code);
    const isLastUpdatedToday = new Date(lastUpdate.updated_at).toDateString() === new Date().toDateString();

    if (!isLastUpdatedToday || forceUpdate) {
      const queryParams = OculusRequest.getQueryParams({
        requestType: "applications",
        sectionId: headset.id,
        hmdType: headset.code
      });

      const result = await OculusRequest.post(queryParams, `Applications count for ${headset.name}`);
      await MetaScraper.updateInfosForHeadset(lastUpdate.id, result.data.node.all_items.count);
      return result.data.node.all_items.count;
    } else {
      return lastUpdate.count;
    }
  }

  // ###########################################
  // Main GET methods
  // ###########################################

  static async scrapApplications(store = true) {
    console.time("scrapApplications");
    const databaseInfos = await MetaScraper.getDatabaseInfos()
    MetaScraper.displayDatabaseInfos(databaseInfos);

    const applications = await MetaScraper.getOculusStoreApplications({
      allApps: true,
      appsByRequest: 500,
      count: 1, // if allApps is true, this is ignored
      headsets: headsets,
    }, databaseInfos.applicationsMetaIds);

    MetaScraper.displayApplicationsRetrieved(applications);
    const applicationsForAllHeadsets = [].concat(...Object.values(applications));

    if (store) {
      const createdApps = await MetaScraper.createApplicationsInSupabase(applicationsForAllHeadsets);
      MetaScraper.displayBox("Created apps", `Created ${createdApps}/${applicationsForAllHeadsets.length}`)
    }

    console.timeEnd("scrapApplications");
    MetaScraper.displayMessage("\n\nDone!", "success")
  }

  static async scrapApplicationsImages() {
    const applicationsImagesURIs = (await SupabaseRequest.getAll('Applications'));
    const bucketImages = (await SupabaseRequest.listFiles('ApplicationsImages')).map(file => file.name);

    console.log(`Downloading and uploading ${applicationsImagesURIs.length - bucketImages.length} images...`)
    await new Promise(resolve => setTimeout(resolve, 5000));

    const scrappedImages = 0;
    for (const app of applicationsImagesURIs) {
      if (bucketImages.includes(`${app.meta_id}.jpg`)) { continue; }
      const uploaded = MetaScraper.downloadAndUploadImage(app.image_uri, `${app.meta_id}.jpg`);
      if (uploaded) {
        scrappedImages++;
        MetaScraper.displayMessage("Image [" + chalk.green(`${app.meta_id}.jpg`) + "] uploaded")
      }
    }
    MetaScraper.displayBox("Uploaded images", `Uploaded ${scrappedImages}`)
  }

  static async scrapApplicationsDetails(store = true) {
    console.time("scrapApplicationDetails");
    const applications = await SupabaseRequest.getAll('Applications');
    const applicationsDetails = await SupabaseRequest.getAll('ApplicationDetails');
    const applicationDetailsAppIds = applicationsDetails.map(appDetails => appDetails.app);
    const applicationsToScrap = applications.filter(app => !applicationDetailsAppIds.includes(app.id));

    console.log(`Scraping ${applicationsToScrap.length} applications details...`)
    let scrappedDetails = 0;
    for (const app of applicationsToScrap) {
      const locales = await MetaScraper.getLocalesFromSupportedLanguages(app)
      for (const locale of locales) {
        const queryParams = OculusRequest.getQueryParams({
          requestType: "applicationsDetails",
          forced_locale: locale,
          doc_id: '4282918028433524',
          itemId: app.meta_id,
          first: 1,
          last: null,
          after: null,
          before: null,
          forward: true,
          ordering: null,
          ratingScores: null,
        });

        const result = await OculusRequest.post(queryParams, `Application details for ${app.display_name}`);

        if (store) {
          const details = result.data.node;
          if (!(await MetaScraper.validApplicationDetails(app, details))) { break; }
          const status = MetaScraper.createApplicationDetailsInSupabase(app, details, locale)
          if (status === 201) { scrappedDetails += locales.length; }
        }
      }
    }
    MetaScraper.displayBox("Created app details", `Created ${scrappedDetails} from ${applicationsToScrap.length} applications`)
    console.timeEnd("scrapApplicationDetails");
    MetaScraper.displayMessage("\n\nDone!", "success")
  }

  // static async scrapUserApps() {

  // }

  static async scrapAll() {
    this.scrapApplications();
    this.scrapApplicationsDetails();
    this.scrapApplicationsImages();
  }

  static async getInfos() {
    MetaScraper.displayDatabaseInfos();
    MetaScraper.displayOculusStoreInfos();
  }

  // ###########################################
  // Main UPDATE methods
  // ###########################################

  static async updateHeadsetsInfos() {
    for (const headset of headsets) {
      const count = await MetaScraper.getApplicationsCountForHeadset(headset, true);
      MetaScraper.displayMessage(`${headset.name}: ${count}`, "success")
    }
  }

  // ###########################################
  // Get from oculus store
  // ###########################################

  static async getLocalesFromSupportedLanguages(app) {
    const queryParams = OculusRequest.getQueryParams({
      requestType: "applicationsDetails",
      doc_id: '4282918028433524',
      itemId: app.meta_id,
      first: 1,
      last: null,
      after: null,
      before: null,
      forward: true,
      ordering: null,
      ratingScores: null,
    });

    const result = await OculusRequest.post(queryParams, `Application locales for ${app.display_name}`);
    const supportedLanguages = result.data.node.supported_in_app_languages.map(lang => lang.name);
    const localesMatching = {
      'English': 'en_US',
      'French (France)': 'fr_FR'
    }
    return supportedLanguages.filter(lang => Object.keys(localesMatching).includes(lang)).map(lang => localesMatching[lang]);
  }

  static async getOculusStoreApplications(options, alreadyScrappedIds) {
    const retrievedApps = Object.fromEntries(options.headsets.map(headset => [headset.name, []]));

    for (const headset of options.headsets) {
      const totalApplications = await MetaScraper.getApplicationsCountForHeadset(headset);
      MetaScraper.displayMessage(`${headset.name}: ` + chalk.bold.greenBright(`${totalApplications}`))
      const applicationsToRetrieve = options.allApps ? totalApplications : options.count;

      let cursor = null;
      let hasNextPage = true;
      let duplicatesCount = 0;
      const headsetRetrievedApps = [];

      while (((headsetRetrievedApps.length + duplicatesCount) < applicationsToRetrieve) && hasNextPage) {
        const queryParams = OculusRequest.getQueryParams({
          requestType: "applications",
          sectionId: headset.id,
          hmdType: headset.code,
          sectionItemCount: applicationsToRetrieve,
          sectionCursor: cursor
        });
        const results = await OculusRequest.post(queryParams, `Applications for ${headset.name}`);
        if (!results || !results.data || !results.data.node || !results.data.node.all_items) {
          MetaScraper.displayMessage(`No results for ${headset.name}`, "error")
          break;
        }
        hasNextPage = results.data.node.all_items.page_info.has_next_page;
        cursor = results.data.node.all_items.page_info.end_cursor;

        for (const app of results.data.node.all_items.edges) {
          const duplicate = MetaScraper.checkDuplicateApplications(app.node.id, alreadyScrappedIds, retrievedApps);
          if (duplicate) {
            duplicatesCount++;
            continue;
          }
          headsetRetrievedApps.push({
            meta_id: app.node.id,
            display_name: app.node.display_name,
            image_uri: app.node.cover_square_image.uri
          });
        }

        if ((headsetRetrievedApps.length + duplicatesCount) < applicationsToRetrieve) {
          MetaScraper.displayBox("Progress", `Retrieved ${headsetRetrievedApps.length + duplicatesCount}/${applicationsToRetrieve}\nDuplicates: ${duplicatesCount}`)
        }
      }
      retrievedApps[headset.name] = headsetRetrievedApps;
    }
    return retrievedApps;
  }

  static checkDuplicateApplications(appId, alreadyScrappedIds, retrievedApps) {
    if (alreadyScrappedIds.includes(appId)) { return true; }
    for (const headset in retrievedApps) {
      for (const app of retrievedApps[headset]) {
        if (app.meta_id === appId) { return true; }
      }
    }
    return false;
  }

  static async validApplicationDetails(app, details) {
    if (details.current_offer === null || details.current_offer.price.offset_amount === "0") {
      console.log("Application [" + chalk.red(app.display_name) + "] has no price or is free")
      await SupabaseRequest.delete("Applications", app.id)
      await SupabaseRequest.deleteFromStorage("ApplicationsImages", `${app.meta_id}.jpg`)
      return false
    } else {
      return true;
    }
  }

  // ###########################################
  // Create entries in supabase
  // ###########################################

  static async createApplicationsInSupabase(applications) {
    let createdApps = 0;

    console.time("SupabaseInsertAllApplications");
    for (const application of applications) {
      const { status } = await SupabaseRequest.create("Applications", application)
      if (status === 201) { console.log("Application [" + chalk.green(application.display_name) + "] created") }
      createdApps++;
    }
    console.timeEnd("SupabaseInsertAllApplications");
    return createdApps
  }

  static async createApplicationDetailsInSupabase(app, details, locale) {
    const { status } = await SupabaseRequest.create("ApplicationDetails", {
      app: app.id,
      locale: locale,
      category: details.category_name,
      description: details.display_long_description,
      display_name: details.display_name,
      genres: details.genre_names,
      headset_names: HeadsetUtils.getHeadsetsNamesByCodes(details.supported_hmd_platforms),
      publisher: details.publisher_name,
      website_url: details.website_url,
      oculus_url: details.website_page_meta.page_url,
      price: parseFloat(details.current_offer.price.formatted.replace('\u20ac', '')),
      currency: details.current_offer.price.currency,
      rating: details.quality_rating_aggregate || 0
    })

    if (status === 201) { console.log("Application details of [" + chalk.green(app.display_name) + "][" + chalk.blueBright(locale) + "] created") }
    return status
  }

  static async downloadAndUploadImage(uri, fileName) {
    try {
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const base64String = Buffer.from(arrayBuffer).toString('base64');
      const uploaded = await SupabaseRequest.uploadImageToStorage("ApplicationsImages", fileName, base64String)
      return uploaded;
    } catch (error) {
      console.error('Error downloading and uploading image:', error);
      return false
    }
  }

  // ###########################################
  // Update entries in supabase
  // ###########################################

  static async updateInfosForHeadset(id, count) {
    const { status } = await SupabaseRequest.update("MetaHeadsetsApps", id, { count: count })
    if (status === 204) { console.log("Updated count for " + chalk.green(hmdType)) }
  }

  // ###########################################
  // Get entries in supabase
  // ###########################################

  static async getInfosForHeadset(hmdType) {
    return (await SupabaseRequest.getOneByProperty("MetaHeadsetsApps", "*", "headset", hmdType)).data
  }

  // ###########################################
  // Displays
  // ###########################################

  static async displayDatabaseInfos(informations) {
    const infos = informations || await MetaScraper.getDatabaseInfos();

    MetaScraper.displayBox(
      "Database infos",
      `Applications: ${infos.numberOfApplications}\nApplications details: ${infos.numberOfApplicationsDetails}\nApplications images: ${infos.numberOfApplicationsImages}`
    )
  }

  static async displayOculusStoreInfos(informations) {
    const infos = informations || await MetaScraper.getOculusStoreInfos();

    MetaScraper.displayBox(
      "Oculus store infos",
      infos.map(info => `${info.headset}: ${info.total}`).join('\n')
    )
  }

  static displayApplicationsRetrieved(applications) {
    const total = Object.keys(applications).reduce((acc, headset) => acc + applications[headset].length, 0);
    MetaScraper.displayBox(
      "Applications retrieved",
      Object.keys(applications).map(headset => `${headset}: ${applications[headset].length}`).join('\n') + chalk.green(`\n\nTotal: ${total}`)
    )
  }

  // ###########################################
  // Generic display methods
  // ###########################################

  static displayMessage(message, type) {
    switch (type) {
      case "success":
        console.log(chalk.green(message))
        break;
      case "error":
        console.log(chalk.red(message))
        break;
      case "warning":
        console.log(chalk.yellow(message))
        break;
      case "info":
        console.log(chalk.blueBright(message))
        break;
      default:
        console.log(message)
        break;
    }
  }

  static displayBox(title, message) {
    const boxenOptions = {
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: "green",
      title: title,
      titleAlignment: 'center'
    };
    const msg = boxen(message, boxenOptions)
    console.log(msg)
  }

}
