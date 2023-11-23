#!/usr/bin/env node

import { program, Argument } from 'commander';
import MetaScraper from '../src/MetaScraper.js';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.OCULUS_ACCESS_TOKEN) {
  console.error('OCULUS_ACCESS_TOKEN is not set');
  process.exit(1);
}

const commands = {
  get: {
    // Get all applications for all headsets
    // Store them in Supabase (Application model)
    overviews: MetaScraper.scrapApplications,
    // Get all applications details
    // Store them in Supabase (ApplicationDetails model)
    details: MetaScraper.scrapApplicationsDetails,
    // Get all applications images
    // Store them in Supabase (storage)
    images: MetaScraper.scrapApplicationsImages,
    // Get all applications infos
    infos: MetaScraper.getInfos,
    // Get all applications for a specific user
    userApps: MetaScraper.scrapUserApps,
    // Do all other actions in order
    all: MetaScraper.scrapAll
  },
  update: {
    // Update headsets infos
    headsets: MetaScraper.updateHeadsetsInfos,
  }
}

program
.command('get')
.addArgument(new Argument('<option>', 'choose what to get').choices(['overviews', 'details', 'images', 'infos', 'all']))
.description('Retrieve store applications')
.action((option) => {
  console.log('Starting get command...');
  commands.get[option]();
});

program
.command('update')
.addArgument(new Argument('<option>', 'choose what to update').choices(['headsets']))
.description('Update applications and headsets infos')
.action((option) => {
  console.log('Starting update command...');
  commands.update[option]();
});

program.parse(process.argv);
