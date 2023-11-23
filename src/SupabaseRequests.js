import { createClient } from '@supabase/supabase-js'
import { decode } from 'base64-arraybuffer'
import dotenv from 'dotenv';
import chalk from 'chalk';
dotenv.config();

export default class SupabaseRequest {
  static client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

  // Insert in [entity] the [data]
  static async create(entity, columns) {
    console.time("SupabaseInsert");
    try {
      const { data, error, status } = await this.client
        .from(entity)
        .insert(columns)
      if (error) { throw error }
      console.timeEnd("SupabaseInsert");
      return { data, status }
    } catch (err) {
      console.error(err)
    }
  }

  // Get all [entity] with [select] columns
  static async getAll(entity, select = '*') {
    console.time("SupabaseSelectAll");
    try {
      const { data, error } = await this.client
        .from(entity)
        .select(select)
      if (error) { throw error }
      console.timeEnd("SupabaseSelectAll");
      return data
    } catch (err) {
      console.error(err)
    }
  }

  // Get count of [entity]
  static async getCount(entity) {
    console.time("SupabaseCount");
    try {
      const { error, count } = await this.client
        .from(entity)
        .select('*', { count: 'exact', head: true })
      if (error) { throw error }
      console.timeEnd("SupabaseCount");
      return count
    } catch (err) {
      console.error(err)
    }
  }

  // Update [entity] with [datas] where id is [id]
  static async update(entity, id, datas) {
    console.time("SupabaseUpdate");
    try {
      const { error, status } = await this.client
        .from(entity)
        .update(datas)
        .eq('id', id)
      if (error) { throw error }
      console.timeEnd("SupabaseUpdate");
      return status
    } catch (err) {
      console.error(err)
    }
  }

  // Get one [entity] with [select] columns where id is [id]
  static async getOneById(entity, select = '*', id) {
    console.time("SupabaseSelectOneById");
    try {
      const { data, error } = await this.client
        .from(entity)
        .select(select)
        .eq('id', id)
        .limit(1)
        .single()
      if (error) { throw error }
      console.timeEnd("SupabaseSelectOneById");
      return data
    } catch (err) {
      console.error(err)
    }
  }

  // Get one [entity] with [select] columns where [property_name] is [property_value]
  static async getOneByProperty(entity, select = '*', property_name, property_value) {
    console.time("SupabaseSelectOneByProperty");
    try {
      const { data, error, status } = await this.client
        .from(entity)
        .select(select)
        .eq(property_name, property_value)
        .limit(1)
        .single()
      if (error) { throw error }
      console.timeEnd("SupabaseSelectOneByProperty");
      return { data, status }
    } catch (err) {
      console.error(err)
    }
  }

  static async delete(entity, id) {
    console.time("SupabaseDelete");
    try {
      const { error, status } = await this.client
        .from(entity)
        .delete()
        .eq('id', id)
      if (error) { throw error }
      console.timeEnd("SupabaseDelete");
      return status
    } catch (err) {
      console.error(err)
    }
  }

  // ###########################################
  // Storage
  // ###########################################

  // Upload [base64Image] to [bucketName] with [fileName]
  static async uploadImageToStorage(bucketName, fileName, base64Image) {
    console.time("SupabaseUploadImageToStorage");
    const { error } = await this.client
    .storage
    .from(bucketName)
    .upload(
      fileName,
      decode(base64Image), {
        contentType: 'image/jpeg', // Replace with the appropriate content type for your image
        cacheControl: 'public, max-age=31536000'
      }
    );

    console.timeEnd("SupabaseUploadImageToStorage");
    return error ? false : true
  }

  // List all files in [bucketName]
  static async listFiles(bucketName) {
    console.time(chalk.blue("SupabaseListFiles"));
    const { data, error } = await this.client
      .storage
      .from(bucketName)
      .list('', {
        limit: 3000
      })

    console.timeEnd(chalk.blue("SupabaseListFiles"));
    return error ? false : data
  }

  static async deleteFromStorage(bucketName, fileName) {
    console.time("SupabaseDeleteFromStorage");
    const { error } = await this.client
      .storage
      .from(bucketName)
      .remove([fileName])

    console.timeEnd("SupabaseDeleteFromStorage");
    return error ? false : true
  }
}
