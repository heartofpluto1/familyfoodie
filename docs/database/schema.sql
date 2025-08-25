-- MySQL dump 10.13  Distrib 9.3.0, for macos14.7 (x86_64)
--
-- Host: localhost    Database: [DATABASE_NAME]
-- ------------------------------------------------------
-- Server version	8.0.x

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `category_pantry`
--

DROP TABLE IF EXISTS `category_pantry`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `category_pantry` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `category_supermarket`
--

DROP TABLE IF EXISTS `category_supermarket`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `category_supermarket` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `collections`
--

DROP TABLE IF EXISTS `collections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `collections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `subtitle` text,
  `filename` varchar(255) DEFAULT 'custom_collection_004',
  `filename_dark` varchar(255) DEFAULT 'custom_collection_004_dark',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `url_slug` varchar(255) NOT NULL DEFAULT '1-initial',
  PRIMARY KEY (`id`),
  KEY `idx_title` (`title`),
  KEY `idx_url_slug` (`url_slug`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ingredients`
--

DROP TABLE IF EXISTS `ingredients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ingredients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(64) NOT NULL,
  `fresh` tinyint(1) NOT NULL,
  `supermarketCategory_id` int NOT NULL,
  `cost` double DEFAULT NULL,
  `stockcode` int DEFAULT NULL,
  `public` tinyint(1) NOT NULL,
  `pantryCategory_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `menus_ingredients_category_id_19b50d48_fk_menus_sup` (`supermarketCategory_id`),
  KEY `menus_ingredient_pantryCategory_id_5bedb1cc_fk_menus_pan` (`pantryCategory_id`),
  CONSTRAINT `menus_ingredient_pantryCategory_id_5bedb1cc_fk_menus_pan` FOREIGN KEY (`pantryCategory_id`) REFERENCES `category_pantry` (`id`),
  CONSTRAINT `menus_ingredient_supermarketCategory__d7fc947f_fk_menus_sup` FOREIGN KEY (`supermarketCategory_id`) REFERENCES `category_supermarket` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=410 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `measurements`
--

DROP TABLE IF EXISTS `measurements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `measurements` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `plans`
--

DROP TABLE IF EXISTS `plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `week` smallint NOT NULL,
  `year` smallint NOT NULL,
  `recipe_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `menus_recipeweek_da50e9c3` (`recipe_id`),
  CONSTRAINT `menus_recipeweek_recipe_id_4ff45663a2e8e49d_fk_menus_recipe_id` FOREIGN KEY (`recipe_id`) REFERENCES `recipes` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1725 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `preparations`
--

DROP TABLE IF EXISTS `preparations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `preparations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `recipe_ingredients`
--

DROP TABLE IF EXISTS `recipe_ingredients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recipe_ingredients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `quantity` varchar(16) NOT NULL,
  `ingredient_id` int NOT NULL,
  `recipe_id` int NOT NULL,
  `preperation_id` int DEFAULT NULL,
  `primaryIngredient` tinyint(1) NOT NULL,
  `quantity4` varchar(16) NOT NULL,
  `quantityMeasure_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `menus_recipeingredients_7a06a9e2` (`ingredient_id`),
  KEY `menus_recipeingredients_da50e9c3` (`recipe_id`),
  KEY `menus_recipeingredients_2fac932d` (`preperation_id`),
  KEY `menus_recipeingredients_5071bd2a` (`quantityMeasure_id`),
  CONSTRAINT `menus_re_preperation_id_24f90a2206fa673e_fk_menus_preperation_id` FOREIGN KEY (`preperation_id`) REFERENCES `preparations` (`id`),
  CONSTRAINT `menus_re_quantityMeasure_id_22c6089332a864ec_fk_menus_measure_id` FOREIGN KEY (`quantityMeasure_id`) REFERENCES `measurements` (`id`),
  CONSTRAINT `menus_recipeingred_recipe_id_12e8587e0cec8eee_fk_menus_recipe_id` FOREIGN KEY (`recipe_id`) REFERENCES `recipes` (`id`),
  CONSTRAINT `menus_recipeingredie_ingredient_id_23d8ab19_fk_menus_ing` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4262 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `recipes`
--

DROP TABLE IF EXISTS `recipes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recipes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(64) NOT NULL,
  `prepTime` smallint DEFAULT NULL,
  `cookTime` smallint NOT NULL,
  `description` longtext,
  `duplicate` tinyint(1) NOT NULL,
  `season_id` int DEFAULT NULL,
  `primaryType_id` int DEFAULT NULL,
  `secondaryType_id` int DEFAULT NULL,
  `public` tinyint(1) NOT NULL,
  `collection_id` int DEFAULT NULL,
  `url_slug` varchar(255) NOT NULL,
  `image_filename` varchar(100) DEFAULT NULL,
  `pdf_filename` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `menus_recipe_season_id_dafbec51_fk_menus_season_id` (`season_id`),
  KEY `menus_recipe_primaryType_id_2d656011_fk_menus_primarytype_id` (`primaryType_id`),
  KEY `menus_recipe_secondaryType_id_8ff8267b_fk_menus_secondarytype_id` (`secondaryType_id`),
  KEY `idx_collection_id` (`collection_id`),
  KEY `idx_recipe_url_slug` (`url_slug`),
  KEY `idx_image_filename` (`image_filename`),
  KEY `idx_pdf_filename` (`pdf_filename`),
  CONSTRAINT `fk_recipes_collection` FOREIGN KEY (`collection_id`) REFERENCES `collections` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `menus_recipe_primaryType_id_2d656011_fk` FOREIGN KEY (`primaryType_id`) REFERENCES `type_proteins` (`id`),
  CONSTRAINT `menus_recipe_season_id_dafbec51_fk_menus_season_id` FOREIGN KEY (`season_id`) REFERENCES `seasons` (`id`),
  CONSTRAINT `menus_recipe_secondaryType_id_8ff8267b_fk` FOREIGN KEY (`secondaryType_id`) REFERENCES `type_carbs` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=298 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `schema_migrations`
--

DROP TABLE IF EXISTS `schema_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schema_migrations` (
  `version` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `executed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `execution_time_ms` int DEFAULT NULL,
  PRIMARY KEY (`version`),
  KEY `idx_executed_at` (`executed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `seasons`
--

DROP TABLE IF EXISTS `seasons`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `seasons` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `shopping_lists`
--

DROP TABLE IF EXISTS `shopping_lists`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shopping_lists` (
  `id` int NOT NULL AUTO_INCREMENT,
  `week` smallint NOT NULL,
  `year` smallint NOT NULL,
  `fresh` tinyint(1) NOT NULL,
  `name` varchar(40) NOT NULL,
  `sort` smallint NOT NULL,
  `cost` double DEFAULT NULL,
  `recipeIngredient_id` int DEFAULT NULL,
  `purchased` tinyint(1) NOT NULL,
  `stockcode` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `menus_shoppinglist_recipeIngredient_id_1b4f44ab_fk_menus_rec` (`recipeIngredient_id`),
  CONSTRAINT `menus_shoppinglist_recipeIngredient_id_1b4f44ab_fk_menus_rec` FOREIGN KEY (`recipeIngredient_id`) REFERENCES `recipe_ingredients` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=20042 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `type_carbs`
--

DROP TABLE IF EXISTS `type_carbs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `type_carbs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `type_proteins`
--

DROP TABLE IF EXISTS `type_proteins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `type_proteins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `password` varchar(128) NOT NULL,
  `last_login` datetime DEFAULT NULL,
  `username` varchar(150) NOT NULL,
  `first_name` varchar(30) NOT NULL,
  `last_name` varchar(150) NOT NULL,
  `email` varchar(254) NOT NULL,
  `is_admin` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL,
  `date_joined` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `idx_auth_user_is_admin` (`is_admin`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

--
-- Populate schema_migrations table to prevent re-running migrations on fresh builds
--

INSERT INTO `schema_migrations` (`version`, `executed_at`, `execution_time_ms`) VALUES
('001_create_schema_migrations.sql', '2025-08-22 10:00:00', 50),
('002_simplify_user_permissions.sql', '2025-08-22 10:00:01', 75),
('003_rename_auth_user_to_users.sql', '2025-08-22 10:00:02', 100),
('004_finalize_users_table_rename_simple.sql', '2025-08-22 10:00:03', 25),
('005_remove_multitenant_system.sql', '2025-08-22 10:00:04', 150),
('006_remove_user_id_make_shared.sql', '2025-08-22 10:00:05', 200),
('007_create_collections_and_rename_tables.sql', '2025-08-22 10:00:06', 300),
('008_remove_django_migrations.sql', '2025-08-22 10:00:07', 50),
('009_rename_ingredient_and_measure_tables.sql', '2025-08-22 10:00:08', 100),
('010_rename_remaining_tables_to_snake_case.sql', '2025-08-22 10:00:09', 125),
('011_insert_initial_collections.sql', '2025-08-22 10:00:10', 75),
('012_assign_recipes_to_first_collection.sql', '2025-08-22 10:00:11', 500),
('013_add_url_slug_fields.sql', '2025-08-22 10:00:12', 150),
('014_add_filename_dark_to_collections.sql', '2025-08-22 10:00:13', 100);
('015_add_versioned_file_columns.sql', '2025-08-22 10:00:14', 100);
('016_fix_url_slug_format_and_constraints.sql', '2025-08-22 10:00:15', 100);
('017_set_default_values_collections_filenames.sql', '2025-08-22 10:00:16', 100);
('018_set_default_value_url_slug.sql', '2025-08-22 10:00:17', 100);
('019_remove_shopping_list_category_redundancy.sql', '2025-08-22 10:00:18', 100);

-- Dump completed on [DATE]