-- MySQL dump 10.13  Distrib 5.5.60, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: familyfoodie
-- ------------------------------------------------------
-- Server version	5.5.60-0+deb8u1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `auth_group`
--

DROP TABLE IF EXISTS `auth_group`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `auth_group` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(80) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `auth_group_permissions`
--

DROP TABLE IF EXISTS `auth_group_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `auth_group_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `group_id` int(11) NOT NULL,
  `permission_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `group_id` (`group_id`,`permission_id`),
  KEY `auth_group_permissions_0e939a4f` (`group_id`),
  KEY `auth_group_permissions_8373b171` (`permission_id`),
  CONSTRAINT `auth_group_permission_group_id_689710a9a73b7457_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`),
  CONSTRAINT `auth_group__permission_id_1f49ccbbdc69d2fc_fk_auth_permission_id` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `auth_permission`
--

DROP TABLE IF EXISTS `auth_permission`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `auth_permission` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `content_type_id` int(11) NOT NULL,
  `codename` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `content_type_id` (`content_type_id`,`codename`),
  KEY `auth_permission_417f1b1c` (`content_type_id`),
  CONSTRAINT `auth__content_type_id_508cf46651277a81_fk_django_content_type_id` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=85 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `auth_user`
--

DROP TABLE IF EXISTS `auth_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `auth_user` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `password` varchar(128) NOT NULL,
  `last_login` datetime DEFAULT NULL,
  `is_superuser` tinyint(1) NOT NULL,
  `username` varchar(150) NOT NULL,
  `first_name` varchar(30) NOT NULL,
  `last_name` varchar(150) NOT NULL,
  `email` varchar(254) NOT NULL,
  `is_staff` tinyint(1) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `date_joined` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `auth_user_groups`
--

DROP TABLE IF EXISTS `auth_user_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `auth_user_groups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `group_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`,`group_id`),
  KEY `auth_user_groups_e8701ad4` (`user_id`),
  KEY `auth_user_groups_0e939a4f` (`group_id`),
  CONSTRAINT `auth_user_groups_group_id_33ac548dcf5f8e37_fk_auth_group_id` FOREIGN KEY (`group_id`) REFERENCES `auth_group` (`id`),
  CONSTRAINT `auth_user_groups_user_id_4b5ed4ffdb8fd9b0_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `auth_user_user_permissions`
--

DROP TABLE IF EXISTS `auth_user_user_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `auth_user_user_permissions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `permission_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`,`permission_id`),
  KEY `auth_user_user_permissions_e8701ad4` (`user_id`),
  KEY `auth_user_user_permissions_8373b171` (`permission_id`),
  CONSTRAINT `auth_user_user_permissi_user_id_7f0938558328534a_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`),
  CONSTRAINT `auth_user_u_permission_id_384b62483d7071f0_fk_auth_permission_id` FOREIGN KEY (`permission_id`) REFERENCES `auth_permission` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `django_admin_log`
--

DROP TABLE IF EXISTS `django_admin_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `django_admin_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `action_time` datetime NOT NULL,
  `object_id` longtext,
  `object_repr` varchar(200) NOT NULL,
  `action_flag` smallint(5) unsigned NOT NULL,
  `change_message` longtext NOT NULL,
  `content_type_id` int(11) DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `django_admin_log_417f1b1c` (`content_type_id`),
  KEY `django_admin_log_e8701ad4` (`user_id`),
  CONSTRAINT `django_admin_log_user_id_52fdd58701c5f563_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`),
  CONSTRAINT `djang_content_type_id_697914295151027a_fk_django_content_type_id` FOREIGN KEY (`content_type_id`) REFERENCES `django_content_type` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=775 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `django_content_type`
--

DROP TABLE IF EXISTS `django_content_type`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `django_content_type` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `app_label` varchar(100) NOT NULL,
  `model` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `django_content_type_app_label_45f3b1d93ec8c61c_uniq` (`app_label`,`model`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `django_migrations`
--

DROP TABLE IF EXISTS `django_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `django_migrations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `app` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `applied` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=62 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `django_session`
--

DROP TABLE IF EXISTS `django_session`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `django_session` (
  `session_key` varchar(40) NOT NULL,
  `session_data` longtext NOT NULL,
  `expire_date` datetime NOT NULL,
  PRIMARY KEY (`session_key`),
  KEY `django_session_de54fa62` (`expire_date`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `menus_account`
--

DROP TABLE IF EXISTS `menus_account`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `menus_account` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `menus_accountingredient`
--

DROP TABLE IF EXISTS `menus_accountingredient`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `menus_accountingredient` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `fresh` tinyint(1) NOT NULL,
  `stockcode` int(11) DEFAULT NULL,
  `cost` double DEFAULT NULL,
  `account_id` int(11) NOT NULL,
  `ingredient_id` int(11) NOT NULL,
  `supermarketCategory_id` int(11) NOT NULL,
  `pantryCategory_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `menus_accountingredient_account_id_d458a35b_fk_menus_account_id` (`account_id`),
  KEY `menus_accountingredi_ingredient_id_5678861d_fk_menus_ing` (`ingredient_id`),
  KEY `menus_accountingredi_supermarketCategory__8334099c_fk_menus_sup` (`supermarketCategory_id`),
  KEY `menus_accountingredi_pantryCategory_id_f590518c_fk_menus_pan` (`pantryCategory_id`),
  CONSTRAINT `menus_accountingredient_account_id_d458a35b_fk_menus_account_id` FOREIGN KEY (`account_id`) REFERENCES `menus_account` (`id`),
  CONSTRAINT `menus_accountingredi_ingredient_id_5678861d_fk_menus_ing` FOREIGN KEY (`ingredient_id`) REFERENCES `menus_ingredient` (`id`),
  CONSTRAINT `menus_accountingredi_pantryCategory_id_f590518c_fk_menus_pan` FOREIGN KEY (`pantryCategory_id`) REFERENCES `menus_pantrycategory` (`id`),
  CONSTRAINT `menus_accountingredi_supermarketCategory__8334099c_fk_menus_sup` FOREIGN KEY (`supermarketCategory_id`) REFERENCES `menus_supermarketcategory` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12668 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `menus_accountrecipe`
--

DROP TABLE IF EXISTS `menus_accountrecipe`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `menus_accountrecipe` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `account_id` int(11) NOT NULL,
  `recipe_id` int(11) NOT NULL,
  `archive` tinyint(1) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `menus_accountrecipe_account_id_4c64c3bb_fk_menus_account_id` (`account_id`),
  KEY `menus_accountrecipe_recipe_id_ec4306ff_fk_menus_recipe_id` (`recipe_id`),
  CONSTRAINT `menus_accountrecipe_account_id_4c64c3bb_fk_menus_account_id` FOREIGN KEY (`account_id`) REFERENCES `menus_account` (`id`),
  CONSTRAINT `menus_accountrecipe_recipe_id_ec4306ff_fk_menus_recipe_id` FOREIGN KEY (`recipe_id`) REFERENCES `menus_recipe` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8375 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `menus_accountuser`
--

DROP TABLE IF EXISTS `menus_accountuser`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `menus_accountuser` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `account_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `menus_accountuser_user_id_e43c9326_uniq` (`user_id`),
  KEY `menus_accountuser_account_id_dd895429_fk_menus_account_id` (`account_id`),
  CONSTRAINT `menus_accountuser_account_id_dd895429_fk_menus_account_id` FOREIGN KEY (`account_id`) REFERENCES `menus_account` (`id`),
  CONSTRAINT `menus_accountuser_user_id_e43c9326_fk_auth_user_id` FOREIGN KEY (`user_id`) REFERENCES `auth_user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `menus_ingredient`
--

DROP TABLE IF EXISTS `menus_ingredient`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `menus_ingredient` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(64) NOT NULL,
  `fresh` tinyint(1) NOT NULL,
  `supermarketCategory_id` int(11) NOT NULL,
  `cost` double DEFAULT NULL,
  `stockcode` int(11) DEFAULT NULL,
  `public` tinyint(1) NOT NULL,
  `pantryCategory_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `menus_ingredients_category_id_19b50d48_fk_menus_sup` (`supermarketCategory_id`),
  KEY `menus_ingredient_pantryCategory_id_5bedb1cc_fk_menus_pan` (`pantryCategory_id`),
  CONSTRAINT `menus_ingredient_pantryCategory_id_5bedb1cc_fk_menus_pan` FOREIGN KEY (`pantryCategory_id`) REFERENCES `menus_pantrycategory` (`id`),
  CONSTRAINT `menus_ingredient_supermarketCategory__d7fc947f_fk_menus_sup` FOREIGN KEY (`supermarketCategory_id`) REFERENCES `menus_supermarketcategory` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=389 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `menus_measure`
--

DROP TABLE IF EXISTS `menus_measure`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `menus_measure` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `menus_pantrycategory`
--

DROP TABLE IF EXISTS `menus_pantrycategory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `menus_pantrycategory` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `menus_preperation`
--

DROP TABLE IF EXISTS `menus_preperation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `menus_preperation` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `menus_primarytype`
--

DROP TABLE IF EXISTS `menus_primarytype`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `menus_primarytype` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `menus_recipe`
--

DROP TABLE IF EXISTS `menus_recipe`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `menus_recipe` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(64) NOT NULL,
  `prepTime` smallint(6) DEFAULT NULL,
  `cookTime` smallint(6) NOT NULL,
  `filename` varchar(64) DEFAULT NULL,
  `description` longtext,
  `duplicate` tinyint(1) NOT NULL,
  `season_id` int(11) DEFAULT NULL,
  `primaryType_id` int(11) DEFAULT NULL,
  `secondaryType_id` int(11) DEFAULT NULL,
  `public` tinyint(1) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `menus_recipe_season_id_dafbec51_fk_menus_season_id` (`season_id`),
  KEY `menus_recipe_primaryType_id_2d656011_fk_menus_primarytype_id` (`primaryType_id`),
  KEY `menus_recipe_secondaryType_id_8ff8267b_fk_menus_secondarytype_id` (`secondaryType_id`),
  CONSTRAINT `menus_recipe_primaryType_id_2d656011_fk` FOREIGN KEY (`primaryType_id`) REFERENCES `menus_primarytype` (`id`),
  CONSTRAINT `menus_recipe_season_id_dafbec51_fk_menus_season_id` FOREIGN KEY (`season_id`) REFERENCES `menus_season` (`id`),
  CONSTRAINT `menus_recipe_secondaryType_id_8ff8267b_fk` FOREIGN KEY (`secondaryType_id`) REFERENCES `menus_secondarytype` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=257 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `menus_recipeingredient`
--

DROP TABLE IF EXISTS `menus_recipeingredient`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `menus_recipeingredient` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quantity` varchar(16) NOT NULL,
  `ingredient_id` int(11) NOT NULL,
  `recipe_id` int(11) NOT NULL,
  `preperation_id` int(11) DEFAULT NULL,
  `primaryIngredient` tinyint(1) NOT NULL,
  `quantity4` varchar(16) NOT NULL,
  `quantityMeasure_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `menus_recipeingredients_7a06a9e2` (`ingredient_id`),
  KEY `menus_recipeingredients_da50e9c3` (`recipe_id`),
  KEY `menus_recipeingredients_2fac932d` (`preperation_id`),
  KEY `menus_recipeingredients_5071bd2a` (`quantityMeasure_id`),
  CONSTRAINT `menus_recipeingredie_ingredient_id_23d8ab19_fk_menus_ing` FOREIGN KEY (`ingredient_id`) REFERENCES `menus_ingredient` (`id`),
  CONSTRAINT `menus_recipeingred_recipe_id_12e8587e0cec8eee_fk_menus_recipe_id` FOREIGN KEY (`recipe_id`) REFERENCES `menus_recipe` (`id`),
  CONSTRAINT `menus_re_preperation_id_24f90a2206fa673e_fk_menus_preperation_id` FOREIGN KEY (`preperation_id`) REFERENCES `menus_preperation` (`id`),
  CONSTRAINT `menus_re_quantityMeasure_id_22c6089332a864ec_fk_menus_measure_id` FOREIGN KEY (`quantityMeasure_id`) REFERENCES `menus_measure` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3952 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `menus_recipeweek`
--

DROP TABLE IF EXISTS `menus_recipeweek`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `menus_recipeweek` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `week` smallint(6) NOT NULL,
  `year` smallint(6) NOT NULL,
  `recipe_id` int(11) NOT NULL,
  `account_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `menus_recipeweek_da50e9c3` (`recipe_id`),
  KEY `menus_recipeweek_account_id_1bf52443_fk_menus_account_id` (`account_id`),
  CONSTRAINT `menus_recipeweek_account_id_1bf52443_fk_menus_account_id` FOREIGN KEY (`account_id`) REFERENCES `menus_account` (`id`),
  CONSTRAINT `menus_recipeweek_recipe_id_4ff45663a2e8e49d_fk_menus_recipe_id` FOREIGN KEY (`recipe_id`) REFERENCES `menus_recipe` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1612 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `menus_season`
--

DROP TABLE IF EXISTS `menus_season`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `menus_season` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `menus_secondarytype`
--

DROP TABLE IF EXISTS `menus_secondarytype`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `menus_secondarytype` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `menus_shoppinglist`
--

DROP TABLE IF EXISTS `menus_shoppinglist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `menus_shoppinglist` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `week` smallint(6) NOT NULL,
  `year` smallint(6) NOT NULL,
  `fresh` tinyint(1) NOT NULL,
  `name` varchar(40) NOT NULL,
  `sort` smallint(6) NOT NULL,
  `cost` double DEFAULT NULL,
  `recipeIngredient_id` int(11) DEFAULT NULL,
  `purchased` tinyint(1) NOT NULL,
  `account_id` int(11) NOT NULL,
  `stockcode` int(11) DEFAULT NULL,
  `supermarketCategory_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `menus_shoppinglist_recipeIngredient_id_1b4f44ab_fk_menus_rec` (`recipeIngredient_id`),
  KEY `menus_shoppinglist_account_id_dac27379_fk_menus_account_id` (`account_id`),
  KEY `menus_shoppinglist_supermarketCategory__4f049627_fk_menus_sup` (`supermarketCategory_id`),
  CONSTRAINT `menus_shoppinglist_account_id_dac27379_fk_menus_account_id` FOREIGN KEY (`account_id`) REFERENCES `menus_account` (`id`),
  CONSTRAINT `menus_shoppinglist_recipeIngredient_id_1b4f44ab_fk_menus_rec` FOREIGN KEY (`recipeIngredient_id`) REFERENCES `menus_recipeingredient` (`id`),
  CONSTRAINT `menus_shoppinglist_supermarketCategory__4f049627_fk_menus_sup` FOREIGN KEY (`supermarketCategory_id`) REFERENCES `menus_supermarketcategory` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18478 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `menus_supermarketcategory`
--

DROP TABLE IF EXISTS `menus_supermarketcategory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `menus_supermarketcategory` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-28  2:30:31
